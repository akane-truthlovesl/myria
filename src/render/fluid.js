// ─────────────────────────────────────────────────────────────────────────────
//  Fluid optics on the CPU.
//
//  Particles (and tendril stamps) are splatted into a low-resolution scalar
//  field. From that one field everything else is derived:
//    silhouette  — an iso-contour, analytically anti-aliased at any scale
//    dome height — rim bevel from the field + two wide blurs of the coverage
//    normals     — gradient of the dome → refraction, Fresnel, reflection
//    lightmap    — the shadow and the focused caustic the dome throws on the plate
//    halo        — light leaking into the medium
//  No highlight is painted: reflections come from a sphere-mapped environment
//  indexed by the real surface normal; colour comes from Beer–Lambert depth.
// ─────────────────────────────────────────────────────────────────────────────
import { sat } from '../core/util.js';

export const KR = 15;        // particle kernel radius (world units)
export const ISO = 0.62;     // silhouette threshold
const FREF = 2.1;            // field value where the rim bevel saturates
const ISO_H = 0.30;          // the dome rises from a skirt just outside the visible edge → crisp, well-defined rim optics
const A0 = 0.55, A2 = 0.6, A3 = 0.9;       // dome weights: rim bevel, mid blur, wide blur
export const HMAX = A0 + A2 + A3;
const S2 = 6, S3 = 15;       // blur std-devs (world units)
const KAPPA = 9;             // normal tilt per unit dome slope (world units)
const R0 = 2.0, R1 = 9.0;    // refraction displacement: rim constant + per unit thickness (world units)
const FOC = 2.4;             // lens focusing strength (world units per unit slope·height)
const T_AIR = 11, T_GEL = 5.5; // oblique lamp: where a ray would land without the dome / where it lands through it (per unit height)
const HALO_CUT = 0.035;      // halo is soft-clipped so it reaches zero inside the padded box
const LUTN = 256, MC = 128;
export const PAD = 34;        // how far beyond the outermost particle the box reaches (silhouette + lightmap + halo)

// tone curve: identity up to the knee (so untouched scene pixels stay bit-exact), soft shoulder above
const KNEE = 176;
const TONE = new Uint8Array(2048);
for (let v = 0; v < 2048; v++) TONE[v] = v <= KNEE ? v : Math.min(255, Math.round(KNEE + (255 - KNEE) * (1 - Math.exp(-(v - KNEE) / (255 - KNEE)))));
const FRES = new Float32Array(257);
for (let i = 0; i <= 256; i++) FRES[i] = Math.pow(1 - i / 256, 3);

// two-sided exponential blur coefficient for a given std-dev (in cells)
function alphaFor(sigma) { const q = sigma * sigma / 2; if (q < 1e-4) return 0; return ((2 * q + 1) - Math.sqrt(4 * q + 1)) / (2 * q); }
const TINY = 1e-18;   // keeps decaying tails out of the float32 denormal range (denormals stall the CPU)
function blurExp(a, gw, gh, alpha, acc) {
  if (alpha <= 0) return;
  const b = 1 - alpha;
  for (let j = 0; j < gh; j++) {
    const o = j * gw; let v = 0;
    for (let i = 0; i < gw; i++) { v = v * alpha + a[o + i] * b + TINY; a[o + i] = v; }
    v = 0;
    for (let i = gw - 1; i >= 0; i--) { v = v * alpha + a[o + i] * b + TINY; a[o + i] = v; }
  }
  for (let i = 0; i < gw; i++) acc[i] = 0;
  for (let j = 0; j < gh; j++) { const o = j * gw; for (let i = 0; i < gw; i++) { const v = acc[i] * alpha + a[o + i] * b + TINY; acc[i] = v; a[o + i] = v; } }
  for (let i = 0; i < gw; i++) acc[i] = 0;
  for (let j = gh - 1; j >= 0; j--) { const o = j * gw; for (let i = 0; i < gw; i++) { const v = acc[i] * alpha + a[o + i] * b + TINY; acc[i] = v; a[o + i] = v; } }
}

// ── sphere-mapped environment: what a wet dome mirrors under the specimen lamp ──
const matcapCache = new Map();
export function matcap(f0, key = [1.0, 0.97, 0.92], sky = [0.50, 0.80, 0.98], warm = [1.0, 0.62, 0.40]) {
  const id = `${f0.toFixed(3)}|${key}|${sky}|${warm}`;
  let m = matcapCache.get(id); if (m) return m;
  m = new Float32Array(MC * MC * 3);
  const K = [-0.40, -0.60, 0.69], K2 = [0.52, 0.56, 0.64];
  const metal = sat((f0 - 0.1) / 0.6);
  for (let j = 0; j < MC; j++) for (let i = 0; i < MC; i++) {
    // texel → slope (L1 mapping: u = s / (1 + |sx| + |sy|)) → unit normal
    const ux = (i + 0.5) / MC * 2 - 1, uy = (j + 0.5) / MC * 2 - 1;
    const t = Math.abs(ux) + Math.abs(uy);
    let nx, ny, nz; const r2 = ux * ux + uy * uy;
    if (t >= 0.985) { const r = Math.sqrt(r2); nx = ux / r; ny = uy / r; nz = 0.03; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; }
    else { const sx = ux / (1 - t), sy = uy / (1 - t); const l = 1 / Math.sqrt(sx * sx + sy * sy + 1); nx = sx * l; ny = sy * l; nz = l; }
    const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
    const fres = f0 + (1 - f0) * Math.pow(1 - nz, 5);
    const d1 = Math.max(0, rx * K[0] + ry * K[1] + rz * K[2]);
    const d2 = Math.max(0, rx * K2[0] + ry * K2[1] + rz * K2[2]);
    const soft = Math.pow(d1, 7) * 0.30;                 // broad softbox
    const glint = Math.pow(d1, 150) * 2.6;               // the lamp itself — tiny, travels with curvature
    const kick = Math.pow(d2, 40) * 0.22;                // faint bounce from below
    // rim: sky wraps the grazing edge, strongest toward the lamp side
    const nl = Math.sqrt(nx * nx + ny * ny); const az = nl > 1e-4 ? (nx * -0.55 + ny * -0.83) / nl : 0;
    const rim = Math.pow(1 - nz, 2.6) * (0.34 + 0.50 * Math.max(0, az) + 0.10 * Math.max(0, -az));
    // metals mirror a whole room: horizon band + dark floor
    const up = -ry; const horizon = Math.exp(-Math.pow((up - 0.05) * 5, 2));
    const room = (0.16 + 0.5 * sat(up * 0.9 + 0.35) + 0.6 * horizon) * metal;
    const o = (j * MC + i) * 3;
    for (let c = 0; c < 3; c++) {
      const v = key[c] * (soft * (0.25 + fres * 2.2) + glint * (0.22 + fres) + room * fres)
        + sky[c] * rim * (0.75 + metal)
        + warm[c] * kick * (0.3 + fres);
      m[o + c] = v * 255;
    }
  }
  matcapCache.set(id, m);
  return m;
}

// ── a Look is a material's optics baked into lookup tables ───────────────────
// absorb/emit: base pigment · absorbB/emitB: foreign pigment mixed in by the per-particle `mix`
export function makeLook(o) {
  const L = {
    absorb: o.absorb, emit: o.emit, glow: o.glow ?? 0.55, f0: o.f0 ?? 0.045, clarity: o.clarity ?? 1, bulge: o.bulge ?? 1, halo: o.halo ?? 0.5,
    absorbB: o.absorbB || o.absorb, emitB: o.emitB || o.emit, scat: o.scat ?? 0.10, hot: o.hot || null,
  };
  const hotOf = (em) => L.hot || [em[0] + (1.0 - em[0]) * 0.55, em[1] + (0.93 - em[1]) * 0.55, em[2] + (0.74 - em[2]) * 0.55];
  L.TL = new Float32Array(LUTN * 3); L.AL = new Float32Array(LUTN * 3); L.GL = new Float32Array(LUTN * 3);
  L.TLB = new Float32Array(LUTN * 3); L.ALB = new Float32Array(LUTN * 3); L.GLB = new Float32Array(LUTN * 3);
  for (let t = 0; t < LUTN; t++) {
    const h = t / (LUTN - 1) * HMAX * 1.25;
    const e = 1 - Math.exp(-h * 0.62);            // emission / in-scatter accumulates with depth…
    const e2 = 1 - Math.exp(-h * 1.0);
    for (let c = 0; c < 3; c++) {
      for (const [ab, em, T, A, G] of [[L.absorb, L.emit, L.TL, L.AL, L.GL], [L.absorbB, L.emitB, L.TLB, L.ALB, L.GLB]]) {
        const self = Math.exp(-ab[c] * h * 0.30);  // …and is filtered by the pigment on the way out
        T[t * 3 + c] = Math.exp(-ab[c] * h);
        A[t * 3 + c] = em[c] * (L.glow * e * self + L.scat * e2) * 255 * 0.86;
        G[t * 3 + c] = (em[c] + (hotOf(em)[c] - em[c]) * e2) * (0.50 + 0.50 * e2) * 255;
      }
    }
  }
  // what the dome lets through on a short path: the colour of its caustics
  L.caust = [0, 1, 2].map(c => 0.30 + 0.70 * Math.exp(-L.absorb[c] * 0.9) * (0.55 + 0.45 * L.emit[c]));
  L.mc = matcap(L.f0);
  return L;
}

// per-node shading vector layout (interleaved for cache locality)
const now = () => (globalThis.__cpuNow ? globalThis.__cpuNow() : performance.now());
const SV = 16, OX = 0, OY = 1, TR = 2, TG = 3, TB = 4, KR_ = 5, KG = 6, KB = 7, HL = 8, PS = 9, PC = 10, PH = 11, RK = 12;
const HL0 = 42, HL1 = 2.1;        // halo: fog glow + light caught by rims and grid lines (reflectance map)

// one kernel stamp into the density field (+ glow, + pigment)
function stamp(F, G, Mx, gw, gh, cx, cy, R, amp, gl, mx, hasMix) {
  const iR2 = 1 / (R * R);
  let i0 = Math.ceil(cx - R), i1 = Math.floor(cx + R), j0 = Math.ceil(cy - R), j1 = Math.floor(cy + R);
  if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 > gw - 1) i1 = gw - 1; if (j1 > gh - 1) j1 = gh - 1;
  for (let j = j0; j <= j1; j++) {
    const dy = j - cy, dy2 = dy * dy, o = j * gw;
    for (let i = i0; i <= i1; i++) {
      const dx = i - cx; const qq = 1 - (dx * dx + dy2) * iR2;
      if (qq > 0) { const w = qq * qq * qq * amp; F[o + i] += w; G[o + i] += w * gl; if (hasMix) Mx[o + i] += w * mx; }
    }
  }
}

export class Fluid {
  constructor() {
    this.cell = 2;            // field lattice pitch in framebuffer pixels (chosen per frame from the zoom)
    this.cellOverride = 0;
    this.ncap = 0; this.pcap = 0; this.wcap = 0; this.hcap = 0;
    this.stats = { px: 0, plate: 0, nodes: 0, clusters: 0, tSplat: 0, tDome: 0, tShade: 0 };
    this.away = [0.55, 0.83];  // direction pointing away from the key lamp (on the plate)
    this.g = { X0: 0, Y0: 0, X1: 0, Y1: 0, rw: 0, rh: 0, gw: 0, gh: 0, nn: 0, c: 2, zc: 1, amin: 0, amax: 0, jmin: 0, jmax: 0, cx0: 0, cx1: 0, cy0: 0, cy1: 0, shaded: 0, plate: 0 };
  }
  setZoom(z) { this.cell = this.cellOverride || Math.max(1, Math.min(4, Math.round(KR * z / 6.5))); }

  _ensure(nodes, pix, gw, gh) {
    if (nodes > this.ncap) {
      const n = this.ncap = Math.ceil(nodes * 1.5);
      const F = () => new Float32Array(n);
      this.F = F(); this.G = F(); this.Mx = F(); this.D2 = F(); this.D3 = F(); this.Hh = F(); this.Hx = F(); this.Hy = F(); this.Lm = F(); this.Ha = F();
      this.sv = new Float32Array(n * SV); this.cls = new Uint8Array(n); this.nmk = new Uint8Array(n);
    }
    if (pix > this.pcap) { this.pcap = Math.ceil(pix * 1.5); this.scn = new Uint32Array(this.pcap); }
    if (gw + 4 > this.wcap) { this.wcap = gw * 2 + 8; this.acc = new Float32Array(this.wcap); }
    if (gh + 4 > this.hcap) { this.hcap = gh * 2 + 8; this.rmin = new Int32Array(this.hcap); this.rmax = new Int32Array(this.hcap); }
  }

  /**
   * Shade one cluster of fluid into the framebuffer.
   *  C = { look, idx:Int32Array, n, stamps:Float32Array[x,y,r,amp,glow]*, ns, hearts:[x,y,r,s]*, nh,
   *        x0,y0,x1,y1 (world bbox of the content), veil (0..1), hasMix, glowBoost, bulge }
   */
  draw(fb, view, P, C) {
    const z = view.z, c = Math.min(5, this.cell + (C.coarse ? 1 : 0)), g = this.g;
    const pad = C.look.halo > 0.3 ? PAD : 24;      // dim fluids need room for their shadow only
    let X0 = Math.floor((C.x0 - pad - view.ox) * z), Y0 = Math.floor((C.y0 - pad - view.oy) * z);
    let X1 = Math.ceil((C.x1 + pad - view.ox) * z), Y1 = Math.ceil((C.y1 + pad - view.oy) * z);
    if (X0 < 0) X0 = 0; if (Y0 < 0) Y0 = 0; if (X1 > fb.w) X1 = fb.w; if (Y1 > fb.h) Y1 = fb.h;
    X0 -= X0 % c; Y0 -= Y0 % c;                    // lattice is anchored to the screen → no swimming
    const rw = X1 - X0, rh = Y1 - Y0; if (rw < 2 || rh < 2) return;
    const gw = ((rw / c) | 0) + 2, gh = ((rh / c) | 0) + 2;
    this._ensure(gw * gh, rw * rh, gw, gh);
    g.X0 = X0; g.Y0 = Y0; g.X1 = X1; g.Y1 = Y1; g.rw = rw; g.rh = rh; g.gw = gw; g.gh = gh; g.nn = gw * gh; g.c = c; g.zc = z / c;
    const veil = C.veil || 0, L = C.look, bulge = L.bulge * (C.bulge ?? 1), glowBoost = C.glowBoost ?? 1;
    const T0 = now();
    this._splat(view, P, C);
    const T1 = now();
    this._dome(bulge, !!C.hasMix);
    this._light(L.halo * glowBoost * (1 - 0.95 * veil));
    if (!this._classify(L)) return;
    this._nodes(L, z, veil, glowBoost, !!C.hasMix, C.frost || 0);
    const T2 = now();
    this._copy(fb, z, bulge);
    this._shade(fb, L, z);
    const T3 = now();
    const S = this.stats; S.px += g.shaded; S.plate += g.plate; S.nodes += g.nn; S.clusters++; S.tSplat += T1 - T0; S.tDome += T2 - T1; S.tShade += T3 - T2;
  }

  // ── 1. density field: particles, tendril stamps, hearts; clipped by the room's walls ──
  _splat(view, P, C) {
    const g = this.g, { F, G, Mx } = this; const gw = g.gw, gh = g.gh, nn = g.nn, zc = g.zc, z = view.z, invc = 1 / g.c, ox = view.ox, oy = view.oy, X0 = g.X0, Y0 = g.Y0;
    const hasMix = !!C.hasMix;
    for (let k = 0; k < nn; k++) { F[k] = 0; G[k] = 0; }
    if (hasMix) for (let k = 0; k < nn; k++) Mx[k] = 0;
    const px = P.x, py = P.y, rr = P.rr, glow = P.glow, mix = P.mix, idx = C.idx, n = C.n;
    for (let q = 0; q < n; q++) {
      const p = idx[q]; const R = KR * zc * rr[p]; if (R < 0.5) continue;
      stamp(F, G, Mx, gw, gh, ((px[p] - ox) * z - X0) * invc, ((py[p] - oy) * z - Y0) * invc, R, 1, glow[p], hasMix ? mix[p] : 0, hasMix);
    }
    const st = C.stamps;
    for (let q = 0, e = C.ns * 5; q < e; q += 5) stamp(F, G, Mx, gw, gh, ((st[q] - ox) * z - X0) * invc, ((st[q + 1] - oy) * z - Y0) * invc, st[q + 2] * zc, st[q + 3], st[q + 4], 0, false);
    // hearts: a luminous nucleus per body (pure glow, no mass)
    const hs = C.hearts;
    for (let q = 0, e = C.nh * 4; q < e; q += 4) {
      const cx = ((hs[q] - ox) * z - X0) * invc, cy = ((hs[q + 1] - oy) * z - Y0) * invc, R = hs[q + 2] * zc, s = hs[q + 3]; const iR2 = 1 / (R * R);
      let i0 = Math.ceil(cx - R), i1 = Math.floor(cx + R), j0 = Math.ceil(cy - R), j1 = Math.floor(cy + R);
      if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 > gw - 1) i1 = gw - 1; if (j1 > gh - 1) j1 = gh - 1;
      for (let j = j0; j <= j1; j++) { const dy = j - cy, dy2 = dy * dy, o = j * gw; for (let i = i0; i <= i1; i++) { const dx = i - cx; const qq = 1 - (dx * dx + dy2) * iR2; if (qq > 0) G[o + i] += qq * qq * s * F[o + i]; } }
    }
    // walls: gel cannot occupy stone — clip the field by the room's distance field (a crisp contact line)
    const sdf = P.sdf;
    if (sdf && !C.noClip) {
      const sd = sdf.data, sw = sdf.w, sh = sdf.h, ires = 1 / sdf.res, sx0 = sdf.x0, sy0 = sdf.y0; const iz = g.c / z;
      const wx0 = X0 / z + ox, wy0 = Y0 / z + oy;
      for (let j = 0; j < gh; j++) {
        const o = j * gw; let fy = (wy0 + j * iz - sy0) * ires; if (fy < 0) fy = 0; else if (fy > sh - 1.001) fy = sh - 1.001;
        const iy = fy | 0, ty = fy - iy;
        for (let i = 0; i < gw; i++) {
          if (F[o + i] <= 0.05) continue;
          let fx = (wx0 + i * iz - sx0) * ires; if (fx < 0) fx = 0; else if (fx > sw - 1.001) fx = sw - 1.001;
          const ix = fx | 0, tx = fx - ix; const k0 = iy * sw + ix;
          const d = (sd[k0] + (sd[k0 + 1] - sd[k0]) * tx) * (1 - ty) + (sd[k0 + sw] + (sd[k0 + sw + 1] - sd[k0 + sw]) * tx) * ty;
          if (d < 3.5) { const m = d < -1.5 ? 0 : (d + 1.5) * 0.2; F[o + i] *= m * m * (3 - 2 * m); }
        }
      }
    }
  }

  // ── 2. dome: rim bevel straight from the field, body from two blurs of the coverage ──
  _dome(bulge, hasMix) {
    const g = this.g, { F, G, Mx, D2, D3, Hh, acc } = this; const nn = g.nn, gw = g.gw, gh = g.gh, zc = g.zc;
    const invRef = 1 / (FREF - ISO_H);
    for (let k = 0; k < nn; k++) {
      const f = F[k]; let u = (f - ISO_H) * invRef; u = u < 0 ? 0 : u > 1 ? 1 : u;
      D2[k] = u; Hh[k] = A0 * Math.sqrt(u * (2 - u));
      const inv = 1 / (f + 0.25); G[k] *= inv; if (hasMix) Mx[k] *= inv;       // glow / pigment are intensive: normalise by density
    }
    blurExp(D2, gw, gh, alphaFor(S2 * zc), acc);
    for (let k = 0; k < nn; k++) D3[k] = D2[k];
    blurExp(D3, gw, gh, alphaFor(Math.sqrt(S3 * S3 - S2 * S2) * zc), acc);
    for (let k = 0; k < nn; k++) {
      if (F[k] > ISO_H) {
        let u2 = 2 * D2[k] - 0.72; u2 = u2 < 0 ? 0 : u2 > 1 ? 1 : u2;
        let u3 = 2 * D3[k] - 0.72; u3 = u3 < 0 ? 0 : u3 > 1 ? 1 : u3;
        Hh[k] = (Hh[k] + A2 * Math.sqrt(u2 * (2 - u2)) + A3 * Math.sqrt(u3 * (2 - u3))) * bulge;
      } else Hh[k] = 0;
    }
  }

  // ── 3. slopes, halo, and the photon lightmap: every node under the dome sends its share of
  //       lamp light to where the lens bends it (shadow where it left, caustic where it lands) ──
  _light(haK) {
    const g = this.g, { F, D3, Hh, Hx, Hy, Lm, Ha, acc } = this; const gw = g.gw, gh = g.gh, nn = g.nn, zc = g.zc;
    for (let k = 0; k < nn; k++) Lm[k] = 0;
    const ks = 0.5 * zc * KAPPA;
    const foc = FOC * zc, tx = T_GEL * zc * this.away[0], ty = T_GEL * zc * this.away[1], ax = T_AIR * zc * this.away[0], ay = T_AIR * zc * this.away[1];
    const covK = 1 / (FREF * 0.5 - ISO);
    for (let j = 0; j < gh; j++) {
      const o = j * gw;
      for (let i = 0; i < gw; i++) {
        const k = o + i;
        const d3 = D3[k] - HALO_CUT; Ha[k] = d3 > 0 ? d3 * haK : 0;
        const hc = Hh[k];
        if (hc <= 0) { Hx[k] = 0; Hy[k] = 0; continue; }
        const l = i > 0 ? Hh[k - 1] : hc, r = i < gw - 1 ? Hh[k + 1] : hc, u = j > 0 ? Hh[k - gw] : hc, d = j < gh - 1 ? Hh[k + gw] : hc;
        const sx = (l - r) * ks, sy = (u - d) * ks; Hx[k] = sx; Hy[k] = sy;
        let w = (F[k] - ISO) * covK; if (w <= 0) continue; if (w > 1) w = 1;
        let qx = i + ax * hc, qy = j + ay * hc, qi = Math.floor(qx), qj = Math.floor(qy);
        if (qi >= 0 && qj >= 0 && qi < gw - 1 && qj < gh - 1) { const a = qx - qi, b = qy - qj, kk = qj * gw + qi; Lm[kk] -= w * (1 - a) * (1 - b); Lm[kk + 1] -= w * a * (1 - b); Lm[kk + gw] -= w * (1 - a) * b; Lm[kk + gw + 1] -= w * a * b; }
        qx = i + (tx - sx * foc) * hc; qy = j + (ty - sy * foc) * hc; qi = Math.floor(qx); qj = Math.floor(qy);
        if (qi >= 0 && qj >= 0 && qi < gw - 1 && qj < gh - 1) { const a = qx - qi, b = qy - qj, kk = qj * gw + qi; Lm[kk] += w * (1 - a) * (1 - b); Lm[kk + 1] += w * a * (1 - b); Lm[kk + gw] += w * (1 - a) * b; Lm[kk + gw + 1] += w * a * b; }
      }
    }
    // soften the photon map: two binomial passes per axis (kills lattice aliasing, keeps caustic shapes)
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < gh; j++) { const o = j * gw; let p = Lm[o], q = p; for (let i = 0; i < gw - 1; i++) { const nx = Lm[o + i + 1]; Lm[o + i] = (p + 2 * q + nx) * 0.25; p = q; q = nx; } }
      for (let i = 0; i < gw; i++) acc[i] = Lm[i];
      for (let j = 1; j < gh - 1; j++) { const o = j * gw; for (let i = 0; i < gw; i++) { const q = Lm[o + i]; Lm[o + i] = (acc[i] + 2 * q + Lm[o + gw + i]) * 0.25; acc[i] = q; } }
    }
  }

  // ── 4. classify lattice cells: 0 untouched · 1 plate only (shadow / caustic / halo) · 2 gel ──
  _classify(L) {
    const g = this.g, { F, Lm, Ha, cls, nmk, rmin, rmax } = this; const gw = g.gw, gh = g.gh, nn = g.nn;
    for (let k = 0; k < nn; k++) nmk[k] = 0;
    const haVis = 1.2 / (HL0 * Math.max(L.emit[0], L.emit[1], L.emit[2]) + 1e-3);     // halo below ~1 grey level is not worth a pixel
    const isoLo = ISO_H * 0.9;
    let amin = gw, amax = -1, jmin = -1, jmax = -1;
    for (let j = 0; j < gh - 1; j++) {
      const o = j * gw; let mn = gw, mxi = -1;
      for (let i = 0; i < gw - 1; i++) {
        const k = o + i;
        let m = F[k]; if (F[k + 1] > m) m = F[k + 1]; if (F[k + gw] > m) m = F[k + gw]; if (F[k + gw + 1] > m) m = F[k + gw + 1];
        let cl = 0;
        if (m > isoLo) cl = 2;
        else {
          let h = Ha[k]; if (Ha[k + 1] > h) h = Ha[k + 1]; if (Ha[k + gw] > h) h = Ha[k + gw]; if (Ha[k + gw + 1] > h) h = Ha[k + gw + 1];
          if (h > haVis) cl = 1;
          else { const a = Lm[k], b = Lm[k + 1], cc = Lm[k + gw], d = Lm[k + gw + 1]; if (a > 0.02 || a < -0.02 || b > 0.02 || b < -0.02 || cc > 0.02 || cc < -0.02 || d > 0.02 || d < -0.02) cl = 1; }
        }
        cls[k] = cl;
        if (cl) { if (i < mn) mn = i; mxi = i; if (cl > nmk[k]) nmk[k] = cl; if (cl > nmk[k + 1]) nmk[k + 1] = cl; if (cl > nmk[k + gw]) nmk[k + gw] = cl; if (cl > nmk[k + gw + 1]) nmk[k + gw + 1] = cl; }
      }
      rmin[j] = mn; rmax[j] = mxi;
      if (mxi >= 0) { if (mn < amin) amin = mn; if (mxi > amax) amax = mxi; if (jmin < 0) jmin = j; jmax = j; }
    }
    g.amin = amin; g.amax = amax; g.jmin = jmin; g.jmax = jmax;
    return jmin >= 0;
  }

  // ── 5. shading vector per lattice node (interpolated per pixel afterwards) ──
  _nodes(L, z, veil, glowBoost, hasMix, frostK) {
    const g = this.g, { G, Mx, Hh, Hx, Hy, Lm, Ha, sv, nmk } = this; const gw = g.gw, gh = g.gh, invc = 1 / g.c;
    const TL = L.TL, AL = L.AL, GL = L.GL, TLB = L.TLB, ALB = L.ALB, GLB = L.GLB;
    const hs = (LUTN - 1) / (HMAX * 1.25);
    const reflK = 1 - 0.85 * veil, glowK = glowBoost * (1 - 0.9 * veil), bodyK = 1 - 0.75 * veil;
    const SHK = 0.55 * (1 - 0.6 * veil), CK = 44 * (1 - 0.8 * veil);
    const car = L.caust[0], cag = L.caust[1], cab = L.caust[2];
    const rz0 = R0 * z, rz1 = R1 * z, half = 0.5 * invc;
    for (let j = g.jmin; j <= g.jmax + 1; j++) {
      const o = j * gw;
      for (let i = g.amin; i <= g.amax + 1; i++) {
        const k = o + i; const mk = nmk[k]; if (!mk) continue;
        const q = k * SV; const lm = Lm[k];
        sv[q + PS] = lm < 0 ? (lm < -1 ? 1 - SHK : 1 + lm * SHK) : 1; sv[q + PC] = lm > 0 ? (lm > 3 ? 3 : lm) * CK : 0; sv[q + PH] = Ha[k];
        if (mk < 2) continue;
        const hh = Hh[k], sx = Hx[k], sy = Hy[k];
        const inv = 1 / Math.sqrt(sx * sx + sy * sy + 1);
        const m = hh > 0 ? rz0 + rz1 * hh : 0;            // refraction: the dome magnifies — look toward the centre, more where thick
        const ofx = -sx * inv * m, ofy = -sy * inv * m;
        let lx = (i + ofx * invc + half) | 0, ly = (j + ofy * invc + half) | 0;      // where the bent ray lands on the plate
        if (lx < 0) lx = 0; else if (lx > gw - 1) lx = gw - 1; if (ly < 0) ly = 0; else if (ly > gh - 1) ly = gh - 1;
        const lk = ly * gw + lx; const lm2 = Lm[lk];
        const s2 = lm2 < 0 ? (lm2 < -1 ? 1 - SHK : 1 + lm2 * SHK) : 1, c2 = lm2 > 0 ? (lm2 > 3 ? 3 : lm2) * CK : 0;
        let ti = (hh * hs) | 0; if (ti > LUTN - 1) ti = LUTN - 1; ti *= 3;       // Beer–Lambert + volumetric emission
        const gl = G[k] * glowK;
        let tr = TL[ti], tg = TL[ti + 1], tb = TL[ti + 2];
        let ar = AL[ti] * bodyK + GL[ti] * gl, ag = AL[ti + 1] * bodyK + GL[ti + 1] * gl, ab = AL[ti + 2] * bodyK + GL[ti + 2] * gl;
        if (hasMix) {
          let mxv = Mx[k]; if (mxv < frostK) mxv = frostK; mxv = mxv < 0 ? 0 : mxv > 1 ? 1 : mxv;
          if (mxv > 0.01) {
            tr += (TLB[ti] - tr) * mxv; tg += (TLB[ti + 1] - tg) * mxv; tb += (TLB[ti + 2] - tb) * mxv;
            ar += (ALB[ti] * bodyK + GLB[ti] * gl - ar) * mxv; ag += (ALB[ti + 1] * bodyK + GLB[ti + 1] * gl - ag) * mxv; ab += (ALB[ti + 2] * bodyK + GLB[ti + 2] * gl - ab) * mxv;
          }
        }
        const fr = 1 - FRES[(inv * 256) | 0] * 0.55;      // grazing rays reflect instead of transmitting
        tr *= fr; tg *= fr; tb *= fr;
        sv[q + OX] = ofx; sv[q + OY] = ofy;
        sv[q + TR] = tr * s2; sv[q + TG] = tg * s2; sv[q + TB] = tb * s2;
        sv[q + KR_] = car * c2 * tr + ar; sv[q + KG] = cag * c2 * tg + ag; sv[q + KB] = cab * c2 * tb + ab;
        sv[q + HL] = Ha[lk];
        let rk = 0.22 + hh * 1.5; if (rk > 1) rk = 1; sv[q + RK] = rk * reflK;
      }
    }
  }

  // ── 6. a pristine copy of the scene under the cluster: the refraction source ──
  _copy(fb, z, bulge) {
    const g = this.g, scn = this.scn, fpx = fb.px, W = fb.w, c = g.c, rw = g.rw, rh = g.rh, X0 = g.X0, Y0 = g.Y0;
    const bx0 = g.amin * c, by0 = g.jmin * c, bx1 = Math.min(rw, (g.amax + 1) * c), by1 = Math.min(rh, (g.jmax + 1) * c);
    const grow = Math.ceil((R0 + R1 * HMAX * bulge) * z) + 2;     // …grown by the largest displacement a bent ray can have
    const cy0 = Math.max(0, by0 - grow), cy1 = Math.min(rh, by1 + grow), cx0 = Math.max(0, bx0 - grow), cx1 = Math.min(rw, bx1 + grow);
    for (let y = cy0; y < cy1; y++) { const so = (Y0 + y) * W + X0, d = y * rw; for (let x = cx0; x < cx1; x++) scn[d + x] = fpx[so + x]; }
    fb.mark(X0 + bx0, Y0 + by0, X0 + bx1, Y0 + by1);
    g.cx0 = cx0; g.cx1 = cx1; g.cy0 = cy0; g.cy1 = cy1;
  }

  // ── 7. per-pixel optics: shading vectors interpolated across each lattice cell ──
  _shade(fb, L, z) {
    const g = this.g, { F, Hx, Hy, sv, cls, scn, rmin, rmax } = this;
    const c = g.c, invc = 1 / c, gw = g.gw, rw = g.rw, rh = g.rh, X0 = g.X0, Y0 = g.Y0, W = fb.w;
    const fpx = fb.px, refl = fb.refl, mc = L.mc;
    const er = L.emit[0], eg = L.emit[1], eb = L.emit[2], car = L.caust[0], cag = L.caust[1], cab = L.caust[2];
    const frost = (1 - L.clarity) * 5 * z, mch = (MC - 1) * 0.5;
    const xlo = g.cx0, xhi = g.cx1 - 1, ylo = g.cy0, yhi = g.cy1 - 1;
    let shaded = 0, plate = 0;
    for (let j0 = g.jmin; j0 <= g.jmax; j0++) {
      if (rmax[j0] < 0) continue;
      const yb = j0 * c, ye = yb + c < rh ? yb + c : rh, ro = j0 * gw;
      for (let i0 = rmin[j0], ie = rmax[j0]; i0 <= ie; i0++) {
        const k = ro + i0; const cl = cls[k]; if (cl === 0) continue;
        const xb = i0 * c, xe = xb + c < rw ? xb + c : rw;
        const q00 = k * SV, q10 = q00 + SV, q01 = q00 + gw * SV, q11 = q01 + SV;
        const s00 = sv[q00 + PS], s10 = sv[q10 + PS], s01 = sv[q01 + PS], s11 = sv[q11 + PS];
        const c00 = sv[q00 + PC], c10 = sv[q10 + PC], c01 = sv[q01 + PC], c11 = sv[q11 + PC];
        const a00 = sv[q00 + PH], a10 = sv[q10 + PH], a01 = sv[q01 + PH], a11 = sv[q11 + PH];
        if (cl === 1) {
          for (let y = yb; y < ye; y++) {
            const by = (y - yb) * invc; const so = y * rw, fo = (Y0 + y) * W + X0;
            let s = s00 + (s01 - s00) * by; const ds = (s10 + (s11 - s10) * by - s) * invc;
            let cc = c00 + (c01 - c00) * by; const dc = (c10 + (c11 - c10) * by - cc) * invc;
            let ha = a00 + (a01 - a00) * by; const dh = (a10 + (a11 - a10) * by - ha) * invc;
            for (let x = xb; x < xe; x++) {
              const p0 = scn[so + x]; const hv = ha * (HL0 + HL1 * refl[fo + x]);
              const r = (p0 & 255) * s + car * cc + er * hv, gg = ((p0 >> 8) & 255) * s + cag * cc + eg * hv, b = ((p0 >> 16) & 255) * s + cab * cc + eb * hv;
              fpx[fo + x] = 0xff000000 | (TONE[b > 2047 ? 2047 : b | 0] << 16) | (TONE[gg > 2047 ? 2047 : gg | 0] << 8) | TONE[r > 2047 ? 2047 : r | 0];
              s += ds; cc += dc; ha += dh;
            }
          }
          plate += (ye - yb) * (xe - xb);
          continue;
        }
        const f00 = F[k], f10 = F[k + 1], f01 = F[k + gw], f11 = F[k + gw + 1];
        let fmin = f00, fmax = f00;
        if (f10 < fmin) fmin = f10; else if (f10 > fmax) fmax = f10;
        if (f01 < fmin) fmin = f01; else if (f01 > fmax) fmax = f01;
        if (f11 < fmin) fmin = f11; else if (f11 > fmax) fmax = f11;
        const interior = fmin > ISO + (fmax - fmin) + 0.02;
        // analytic edge: coverage from the field value over its (cell-constant) gradient
        const gfx = (f10 - f00 + f11 - f01) * 0.5 * invc, gfy = (f01 - f00 + f11 - f10) * 0.5 * invc;
        const icg = 1 / ((Math.sqrt(gfx * gfx + gfy * gfy) + 1e-5) * 1.5);
        const hx00 = Hx[k], hx10 = Hx[k + 1], hx01 = Hx[k + gw], hx11 = Hx[k + gw + 1];
        const hy00 = Hy[k], hy10 = Hy[k + 1], hy01 = Hy[k + gw], hy11 = Hy[k + gw + 1];
        for (let y = yb; y < ye; y++) {
          const by = (y - yb) * invc; const so = y * rw, fo = (Y0 + y) * W + X0;
          let v;
          v = sv[q00 + OX]; let ofx = v + (sv[q01 + OX] - v) * by; v = sv[q10 + OX]; const dox = (v + (sv[q11 + OX] - v) * by - ofx) * invc;
          v = sv[q00 + OY]; let ofy = v + (sv[q01 + OY] - v) * by; v = sv[q10 + OY]; const doy = (v + (sv[q11 + OY] - v) * by - ofy) * invc;
          v = sv[q00 + TR]; let tr = v + (sv[q01 + TR] - v) * by; v = sv[q10 + TR]; const dtr = (v + (sv[q11 + TR] - v) * by - tr) * invc;
          v = sv[q00 + TG]; let tg = v + (sv[q01 + TG] - v) * by; v = sv[q10 + TG]; const dtg = (v + (sv[q11 + TG] - v) * by - tg) * invc;
          v = sv[q00 + TB]; let tb = v + (sv[q01 + TB] - v) * by; v = sv[q10 + TB]; const dtb = (v + (sv[q11 + TB] - v) * by - tb) * invc;
          v = sv[q00 + KR_]; let kr = v + (sv[q01 + KR_] - v) * by; v = sv[q10 + KR_]; const dkr = (v + (sv[q11 + KR_] - v) * by - kr) * invc;
          v = sv[q00 + KG]; let kg = v + (sv[q01 + KG] - v) * by; v = sv[q10 + KG]; const dkg = (v + (sv[q11 + KG] - v) * by - kg) * invc;
          v = sv[q00 + KB]; let kb = v + (sv[q01 + KB] - v) * by; v = sv[q10 + KB]; const dkb = (v + (sv[q11 + KB] - v) * by - kb) * invc;
          v = sv[q00 + HL]; let h2 = v + (sv[q01 + HL] - v) * by; v = sv[q10 + HL]; const dh2 = (v + (sv[q11 + HL] - v) * by - h2) * invc;
          v = sv[q00 + RK]; let rk = v + (sv[q01 + RK] - v) * by; v = sv[q10 + RK]; const drk = (v + (sv[q11 + RK] - v) * by - rk) * invc;
          let sx = hx00 + (hx01 - hx00) * by; const dsx = (hx10 + (hx11 - hx10) * by - sx) * invc;
          let sy = hy00 + (hy01 - hy00) * by; const dsy = (hy10 + (hy11 - hy10) * by - sy) * invc;
          let f = f00 + (f01 - f00) * by; const df = (f10 + (f11 - f10) * by - f) * invc;
          let s = s00 + (s01 - s00) * by; const ds = (s10 + (s11 - s10) * by - s) * invc;
          let cc = c00 + (c01 - c00) * by; const dc = (c10 + (c11 - c10) * by - cc) * invc;
          let ha = a00 + (a01 - a00) * by; const dh = (a10 + (a11 - a10) * by - ha) * invc;
          for (let x = xb; x < xe; x++, ofx += dox, ofy += doy, tr += dtr, tg += dtg, tb += dtb, kr += dkr, kg += dkg, kb += dkb, h2 += dh2, rk += drk, sx += dsx, sy += dsy, f += df, s += ds, cc += dc, ha += dh) {
            let cov = 1;
            if (!interior) {
              cov = 0.5 + (f - ISO) * icg;
              if (cov <= 0) {
                const p0 = scn[so + x]; const hv = ha * (HL0 + HL1 * refl[fo + x]);
                const r = (p0 & 255) * s + car * cc + er * hv, gg = ((p0 >> 8) & 255) * s + cag * cc + eg * hv, b = ((p0 >> 16) & 255) * s + cab * cc + eb * hv;
                fpx[fo + x] = 0xff000000 | (TONE[b > 2047 ? 2047 : b | 0] << 16) | (TONE[gg > 2047 ? 2047 : gg | 0] << 8) | TONE[r > 2047 ? 2047 : r | 0];
                continue;
              }
              if (cov > 1) cov = 1;
            }
            let fx = x + ofx + 0.5, fy = y + ofy + 0.5;
            if (frost > 0) { const hsh = (Math.imul(x + X0, 374761393) + Math.imul(y + Y0, 668265263)) >>> 0; fx += ((hsh & 255) / 255 - 0.5) * frost; fy += (((hsh >> 8) & 255) / 255 - 0.5) * frost; }
            let xs = fx | 0, ys = fy | 0;
            if (xs < xlo) xs = xlo; else if (xs > xhi) xs = xhi; if (ys < ylo) ys = ylo; else if (ys > yhi) ys = yhi;
            const ps = scn[ys * rw + xs];
            let r = ps & 255, gg = (ps >> 8) & 255, b = (ps >> 16) & 255;
            if (ofx * ofx + ofy * ofy > 6) {          // chromatic dispersion where the bend is strong
              let xr = (x + ofx * 0.86 + 0.5) | 0, yr = (y + ofy * 0.86 + 0.5) | 0, xq = (x + ofx * 1.16 + 0.5) | 0, yq = (y + ofy * 1.16 + 0.5) | 0;
              if (xr < xlo) xr = xlo; else if (xr > xhi) xr = xhi; if (yr < ylo) yr = ylo; else if (yr > yhi) yr = yhi;
              if (xq < xlo) xq = xlo; else if (xq > xhi) xq = xhi; if (yq < ylo) yq = ylo; else if (yq > yhi) yq = yhi;
              r = scn[yr * rw + xr] & 255; b = (scn[yq * rw + xq] >> 16) & 255;
            }
            const hv = h2 * (HL0 + HL1 * refl[(Y0 + ys) * W + X0 + xs]);
            r = (r + er * hv) * tr + kr; gg = (gg + eg * hv) * tg + kg; b = (b + eb * hv) * tb + kb;
            // mirrored environment, indexed by the per-pixel slope (L1 map: one divide, no sqrt)
            const iu = mch / (1 + (sx < 0 ? -sx : sx) + (sy < 0 ? -sy : sy));
            const mi = (((sy * iu + mch) | 0) * MC + ((sx * iu + mch) | 0)) * 3;
            r += mc[mi] * rk; gg += mc[mi + 1] * rk; b += mc[mi + 2] * rk;
            if (cov < 1) {
              const p0 = scn[so + x]; const hv0 = ha * (HL0 + HL1 * refl[fo + x]);
              const br = (p0 & 255) * s + car * cc + er * hv0, bg = ((p0 >> 8) & 255) * s + cag * cc + eg * hv0, bb = ((p0 >> 16) & 255) * s + cab * cc + eb * hv0;
              r = br + (r - br) * cov; gg = bg + (gg - bg) * cov; b = bb + (b - bb) * cov;
            }
            fpx[fo + x] = 0xff000000 | (TONE[b > 2047 ? 2047 : b | 0] << 16) | (TONE[gg > 2047 ? 2047 : gg | 0] << 8) | TONE[r > 2047 ? 2047 : r | 0];
            shaded++;
          }
        }
      }
    }
    g.shaded = shaded; g.plate = plate;
  }
}
