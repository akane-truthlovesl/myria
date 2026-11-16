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
const A0 = 0.50, A2 = 0.55, A3 = 1.0;       // dome weights: rim bevel, mid blur, wide blur
export const HMAX = A0 + A2 + A3;
const S2 = 7.5, S3 = 16;       // blur std-devs (world units)
const KAPPA = 9;             // normal tilt per unit dome slope (world units)
const R0 = 2.0, R1 = 9.0;    // refraction displacement: rim constant + per unit thickness (world units)
const FOC = 2.4;             // lens focusing strength (world units per unit slope·height)
const T_AIR = 11, T_GEL = 5.5; // oblique lamp: where a ray would land without the dome / where it lands through it (per unit height)
const HALO_CUT = 0.035;      // halo is soft-clipped so it reaches zero inside the padded box
const LUTN = 256, MC = 128;
export const PAD = 34;        // how far beyond the outermost particle the box reaches (silhouette + lightmap + halo)

// tone curve: identity up to the knee (so untouched scene pixels stay bit-exact), soft shoulder above
const KNEE = 200;
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

// ── the studio: what a wet dome mirrors, and how lamp light gathers inside it ──
// One map indexed by surface slope (L1 mapping), MCH channels per texel:
//   0..2  the mirrored room (rgb, 0..255·k): a soft window, a strip light, a low kicker and a sky rim.
//         Highlights are reflections of shaped lights — they slide and stretch with curvature, never painted dots.
//   3     body gain — how much lamp light reaches the eye through the gel at this tilt (deeper on the lamp side)
//   4     crescent  — the bright pool where the dome focuses light on its far side (what makes a bead read as glass)
const MCH = 5;
const AWAY = [0.55, 0.83];           // direction pointing away from the key lamp, on the plate
function softBox(rx, ry, cx, cy, ang, hw, hh, soft) {
  const ca = Math.cos(ang), sa = Math.sin(ang); const x = (rx - cx) * ca + (ry - cy) * sa, y = -(rx - cx) * sa + (ry - cy) * ca;
  const dx = Math.abs(x) - hw, dy = Math.abs(y) - hh; const ox = dx > 0 ? dx : 0, oy = dy > 0 ? dy : 0;
  const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0);
  return sat(0.5 - d / soft);
}
const matcapCache = new Map();
export function matcap(f0, key = [1.0, 0.98, 0.94], sky = [0.62, 0.86, 1.0], warm = [1.0, 0.70, 0.46]) {
  const id = `${f0.toFixed(3)}|${key}|${sky}|${warm}`;
  let m = matcapCache.get(id); if (m) return m;
  m = new Float32Array(MC * MC * MCH);
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
    const up = sat(rz * 5 + 0.15);                                            // lights hang above the plate
    // the window: a rounded softbox up-left, a touch brighter toward its far corner, crossed by one slim mullion
    let win = softBox(rx, ry, -0.40, -0.47, -0.62, 0.25, 0.115, 0.11);
    win *= 0.80 + 0.45 * sat(0.5 - (rx + 0.40) * 1.2);
    const strip = softBox(rx, ry, 0.50, -0.42, 0.95, 0.10, 0.03, 0.12) * 0.22;     // a faint hair light, up-right
    const kick = softBox(rx, ry, 0.36, 0.52, 0.75, 0.22, 0.08, 0.14) * 0.16;       // warm bounce from below
    const veilLight = Math.pow(sat(1 - Math.hypot(rx + 0.36, ry + 0.44) / 1.05), 2) * 0.10;   // the window's soft spill
    // rim: sky wraps the grazing edge, strongest toward the lamp
    const nl = Math.sqrt(nx * nx + ny * ny); const az = nl > 1e-4 ? (nx * -AWAY[0] + ny * -AWAY[1]) / nl : 0;
    const rim = Math.pow(1 - nz, 2.5) * (0.30 + 0.62 * Math.max(0, az) + 0.16 * Math.max(0, -az));
    // metals mirror a whole room: horizon band + dark floor
    const upv = -ry; const horizon = Math.exp(-Math.pow((upv - 0.05) * 5, 2));
    const room = (0.16 + 0.5 * sat(upv * 0.9 + 0.35) + 0.6 * horizon) * metal;
    const o = (j * MC + i) * MCH;
    const gk = 0.30 + fres * 2.4;
    for (let c = 0; c < 3; c++) {
      const v = key[c] * ((win * 2.5 + strip * 2.0 + veilLight) * up * gk + room * fres)
        + sky[c] * rim * (0.85 + metal)
        + warm[c] * kick * up * gk * 2.0;
      m[o + c] = v * 255;
    }
    const tt = nx * AWAY[0] + ny * AWAY[1];                                   // + = this facet looks away from the lamp
    const far = sat(tt / 0.8), near = sat(-tt / 0.8);
    m[o + 3] = 0.80 - 0.34 * near * near * (3 - 2 * near) + 0.22 * far;
    const cq = sat((tt - 0.16) / 0.62); m[o + 4] = cq * cq * (3 - 2 * cq) * (1 - 0.35 * Math.pow(1 - nz, 3));
  }
  matcapCache.set(id, m);
  return m;
}

// ── a Look is a material's optics baked into lookup tables over dome thickness ──
//   emit   body colour (what the gel scatters back) · absorb  what it removes from light passing through
//   lit    the colour of light that has travelled through it (the crescent) · hot  its inner fire
// absorbB/emitB: a foreign pigment mixed in by the per-particle `mix`
export function makeLook(o) {
  const L = {
    absorb: o.absorb, emit: o.emit, glow: o.glow ?? 0.55, f0: o.f0 ?? 0.045, clarity: o.clarity ?? 1, bulge: o.bulge ?? 1, halo: o.halo ?? 0.5,
    absorbB: o.absorbB || o.absorb, emitB: o.emitB || o.emit, scat: o.scat ?? 0.10, hot: o.hot || null, lit: o.lit || null, dens: o.dens ?? 0.95,
  };
  const hotOf = (em) => L.hot || [em[0] + (1.0 - em[0]) * 0.62, em[1] + (0.94 - em[1]) * 0.62, em[2] + (0.80 - em[2]) * 0.62];
  const litOf = (em) => (L.lit && em === L.emit ? L.lit : [em[0] + (1.0 - em[0]) * 0.50, em[1] + (0.90 - em[1]) * 0.50, em[2] + (0.62 - em[2]) * 0.42]);
  const N = LUTN * 3; const F = () => new Float32Array(N);
  L.TL = F(); L.SL = F(); L.CL = F(); L.GL = F(); L.TLB = F(); L.SLB = F(); L.CLB = F(); L.GLB = F();
  const bodyK = 0.42 + 0.78 * L.glow, cresK = 0.30 + 0.70 * L.glow;
  for (let t = 0; t < LUTN; t++) {
    const h = t / (LUTN - 1) * HMAX * 1.25;
    const pig = 1 - Math.exp(-Math.pow(h * L.dens, 1.35));       // pigment gathers in the body; the skirt stays clear
    const e2 = 1 - Math.exp(-h * 1.3);
    for (let c = 0; c < 3; c++) {
      for (const [ab, em, T, S, C, G] of [[L.absorb, L.emit, L.TL, L.SL, L.CL, L.GL], [L.absorbB, L.emitB, L.TLB, L.SLB, L.CLB, L.GLB]]) {
        T[t * 3 + c] = Math.exp(-ab[c] * h * 0.9);
        S[t * 3 + c] = em[c] * (pig + 0.22 * (1 - pig) * (1 - Math.exp(-h * 5))) * Math.exp(-ab[c] * h * 0.20) * 255 * bodyK;       // deepens (and shifts hue) where thick
        C[t * 3 + c] = litOf(em)[c] * (0.25 + 0.75 * pig) * (1 - Math.exp(-h * 2.2)) * 255 * cresK;
        G[t * 3 + c] = hotOf(em)[c] * (0.30 + 0.70 * e2) * 255;        // inner fire shows even in a hair-thin tip
      }
    }
  }
  // what the dome lets through on a short path: the colour of its caustics
  L.caust = [0, 1, 2].map(c => 0.30 + 0.70 * Math.exp(-L.absorb[c] * 0.9) * (0.55 + 0.45 * L.emit[c]));
  L.mc = matcap(L.f0);
  return L;
}

const now = () => (globalThis.__cpuNow ? globalThis.__cpuNow() : performance.now());
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

const DBG = +(globalThis.process && globalThis.process.env && globalThis.process.env.FDBG || 0);
export class Fluid {
  constructor() {
    this.cell = 2;            // field lattice pitch in framebuffer pixels (chosen per frame from the zoom)
    this.cellOverride = 0;
    this.ncap = 0; this.pcap = 0; this.wcap = 0; this.hcap = 0;
    this.stats = { px: 0, plate: 0, nodes: 0, clusters: 0, tSplat: 0, tDome: 0, tShade: 0 };
    this.away = AWAY;           // direction pointing away from the key lamp (on the plate)
    this.g = { X0: 0, Y0: 0, X1: 0, Y1: 0, rw: 0, rh: 0, gw: 0, gh: 0, nn: 0, c: 2, zc: 1, amin: 0, amax: 0, jmin: 0, jmax: 0, cx0: 0, cx1: 0, cy0: 0, cy1: 0, shaded: 0, plate: 0 };
  }
  setZoom(z) { this.cell = this.cellOverride || Math.max(1, Math.min(4, Math.round(KR * z / 6.5))); }

  _ensure(nodes, pix, gw, gh) {
    if (nodes > this.ncap) {
      const n = this.ncap = Math.ceil(nodes * 1.5);
      const F = () => new Float32Array(n);
      this.F = F(); this.G = F(); this.Mx = F(); this.D2 = F(); this.D3 = F(); this.Hh = F(); this.Hx = F(); this.Hy = F(); this.Lm = F(); this.Ha = F();
      this.Ps = F(); this.Pc = F(); this.cls = new Uint8Array(n); this.nmk = new Uint8Array(n);
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
    this._nodes(veil);
    const T2 = now();
    this._copy(fb, z, bulge);
    this._shade(fb, L, z, { veil, glowBoost, hasMix: !!C.hasMix, frost: C.frost || 0 });
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

  // ── 2. dome: a crisp rim bevel straight from the field, a body from two wide blurs of the coverage.
  //       Every term eases in with zero slope except at the true rim, so the surface has no creases
  //       (creases would show as rings in every reflection). ──
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
        let u2 = (D2[k] - 0.20) * 1.25; u2 = u2 < 0 ? 0 : u2 > 1 ? 1 : u2;
        let u3 = (D3[k] - 0.22) * 1.2821; u3 = u3 < 0 ? 0 : u3 > 1 ? 1 : u3;
        Hh[k] = (Hh[k] + A2 * u2 * u2 * (3 - 2 * u2) + A3 * u3 * u3 * (3 - 2 * u3)) * bulge;
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

  // ── 5. what the plate receives at each lattice node: shadow factor and caustic light ──
  _nodes(veil) {
    const g = this.g, { Lm, Ps, Pc, nmk } = this; const gw = g.gw;
    const SHK = 0.50 * (1 - 0.6 * veil), CK = 40 * (1 - 0.8 * veil);
    for (let j = g.jmin; j <= g.jmax + 1; j++) {
      const o = j * gw;
      for (let i = g.amin; i <= g.amax + 1; i++) {
        const k = o + i; if (!nmk[k]) continue; const lm = Lm[k];
        Ps[k] = lm < 0 ? (lm < -1 ? 1 - SHK : 1 + lm * SHK) : 1; Pc[k] = lm > 0 ? (lm > 3 ? 3 : lm) * CK : 0;
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

  // ── 7. per-pixel optics. Six smooth quantities are interpolated across each lattice cell
  //       (field, height, slope, inner glow, pigment); everything else is looked up per pixel:
  //       refraction with dispersion → Beer–Lambert → in-scatter shaped by the studio → mirrored room. ──
  _shade(fb, L, z, o) {
    const g = this.g, { F, Hh, Hx, Hy, G, Mx, Ps, Pc, Ha, cls, scn, rmin, rmax } = this;
    const c = g.c, invc = 1 / c, gw = g.gw, rw = g.rw, rh = g.rh, X0 = g.X0, Y0 = g.Y0, W = fb.w;
    const fpx = fb.px, refl = fb.refl, mc = L.mc;
    const TL = L.TL, SL = L.SL, CL = L.CL, GL = L.GL, TLB = L.TLB, SLB = L.SLB, CLB = L.CLB, GLB = L.GLB;
    const er = L.emit[0], eg = L.emit[1], eb = L.emit[2], car = L.caust[0], cag = L.caust[1], cab = L.caust[2];
    const veil = o.veil, hasMix = o.hasMix, frostK = o.frost;
    const reflK = 1 - 0.85 * veil, glowK = o.glowBoost * (1 - 0.9 * veil), bodyK = 1 - 0.80 * veil, clearK = 0.85 * veil;
    const hs = (LUTN - 1) / (HMAX * 1.25), rz0 = R0 * z, rz1 = R1 * z;
    const frost = (1 - L.clarity) * 5 * z, mch = (MC - 1) * 0.5;
    const xlo = g.cx0, xhi = g.cx1 - 1, ylo = g.cy0, yhi = g.cy1 - 1;
    let shaded = 0, plate = 0;
    for (let j0 = g.jmin; j0 <= g.jmax; j0++) {
      if (rmax[j0] < 0) continue;
      const yb = j0 * c, ye = yb + c < rh ? yb + c : rh, ro = j0 * gw;
      for (let i0 = rmin[j0], ie = rmax[j0]; i0 <= ie; i0++) {
        const k = ro + i0; const cl = cls[k]; if (cl === 0) continue;
        const xb = i0 * c, xe = xb + c < rw ? xb + c : rw;
        const k10 = k + 1, k01 = k + gw, k11 = k01 + 1;
        const s00 = Ps[k], s10 = Ps[k10], s01 = Ps[k01], s11 = Ps[k11];
        const c00 = Pc[k], c10 = Pc[k10], c01 = Pc[k01], c11 = Pc[k11];
        const a00 = Ha[k], a10 = Ha[k10], a01 = Ha[k01], a11 = Ha[k11];
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
        const f00 = F[k], f10 = F[k10], f01 = F[k01], f11 = F[k11];
        let fmin = f00, fmax = f00;
        if (f10 < fmin) fmin = f10; else if (f10 > fmax) fmax = f10;
        if (f01 < fmin) fmin = f01; else if (f01 > fmax) fmax = f01;
        if (f11 < fmin) fmin = f11; else if (f11 > fmax) fmax = f11;
        const interior = fmin > ISO + (fmax - fmin) + 0.02;
        // analytic edge: coverage from the field value over its (cell-constant) gradient
        const gfx = (f10 - f00 + f11 - f01) * 0.5 * invc, gfy = (f01 - f00 + f11 - f10) * 0.5 * invc;
        const icg = 1 / ((Math.sqrt(gfx * gfx + gfy * gfy) + 1e-5) * 1.5);
        const h00 = Hh[k], h10 = Hh[k10], h01 = Hh[k01], h11 = Hh[k11];
        const hx00 = Hx[k], hx10 = Hx[k10], hx01 = Hx[k01], hx11 = Hx[k11];
        const hy00 = Hy[k], hy10 = Hy[k10], hy01 = Hy[k01], hy11 = Hy[k11];
        const g00 = G[k], g10 = G[k10], g01 = G[k01], g11 = G[k11];
        let m00 = 0, m10 = 0, m01 = 0, m11 = 0; if (hasMix) { m00 = Mx[k]; m10 = Mx[k10]; m01 = Mx[k01]; m11 = Mx[k11]; }
        for (let y = yb; y < ye; y++) {
          const by = (y - yb) * invc; const so = y * rw, fo = (Y0 + y) * W + X0;
          let f = f00 + (f01 - f00) * by; const df = (f10 + (f11 - f10) * by - f) * invc;
          let h = h00 + (h01 - h00) * by; const dhh = (h10 + (h11 - h10) * by - h) * invc;
          let sx = hx00 + (hx01 - hx00) * by; const dsx = (hx10 + (hx11 - hx10) * by - sx) * invc;
          let sy = hy00 + (hy01 - hy00) * by; const dsy = (hy10 + (hy11 - hy10) * by - sy) * invc;
          let gl = g00 + (g01 - g00) * by; const dgl = (g10 + (g11 - g10) * by - gl) * invc;
          let mx = m00 + (m01 - m00) * by; const dmx = (m10 + (m11 - m10) * by - mx) * invc;
          let s = s00 + (s01 - s00) * by; const ds = (s10 + (s11 - s10) * by - s) * invc;
          let cc = c00 + (c01 - c00) * by; const dc = (c10 + (c11 - c10) * by - cc) * invc;
          let ha = a00 + (a01 - a00) * by; const dh = (a10 + (a11 - a10) * by - ha) * invc;
          for (let x = xb; x < xe; x++, f += df, h += dhh, sx += dsx, sy += dsy, gl += dgl, mx += dmx, s += ds, cc += dc, ha += dh) {
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
            // refraction: the dome magnifies — look toward the centre, more where thick
            const inv = 1 / Math.sqrt(sx * sx + sy * sy + 1);
            const hh = h > 0 ? h : 0;
            const m = (rz0 + rz1 * hh) * inv; const ofx = -sx * m, ofy = -sy * m;
            let fx = x + ofx + 0.5, fy = y + ofy + 0.5;
            if (frost > 0) { const hsh = (Math.imul(x + X0, 374761393) + Math.imul(y + Y0, 668265263)) >>> 0; fx += ((hsh & 255) / 255 - 0.5) * frost; fy += (((hsh >> 8) & 255) / 255 - 0.5) * frost; }
            let xs = fx | 0, ys = fy | 0;
            if (xs < xlo) xs = xlo; else if (xs > xhi) xs = xhi; if (ys < ylo) ys = ylo; else if (ys > yhi) ys = yhi;
            const ps = scn[ys * rw + xs];
            let r = ps & 255, gg = (ps >> 8) & 255, b = (ps >> 16) & 255;
            if (ofx * ofx + ofy * ofy > 5) {          // chromatic dispersion where the bend is strong
              let xr = (x + ofx * 0.84 + 0.5) | 0, yr = (y + ofy * 0.84 + 0.5) | 0, xq = (x + ofx * 1.18 + 0.5) | 0, yq = (y + ofy * 1.18 + 0.5) | 0;
              if (xr < xlo) xr = xlo; else if (xr > xhi) xr = xhi; if (yr < ylo) yr = ylo; else if (yr > yhi) yr = yhi;
              if (xq < xlo) xq = xlo; else if (xq > xhi) xq = xhi; if (yq < ylo) yq = ylo; else if (yq > yhi) yq = yhi;
              r = scn[yr * rw + xr] & 255; b = (scn[yq * rw + xq] >> 16) & 255;
            }
            const hv = ha * (HL0 + HL1 * refl[(Y0 + ys) * W + X0 + xs]);
            // the studio, indexed by slope (L1 map: one divide, no sqrt)
            const iu = mch / (1 + (sx < 0 ? -sx : sx) + (sy < 0 ? -sy : sy));
            const mi = (((sy * iu + mch) | 0) * MC + ((sx * iu + mch) | 0)) * MCH;
            let ti = (hh * hs) | 0; if (ti > LUTN - 1) ti = LUTN - 1; ti *= 3;
            const fr = 1 - FRES[(inv * 256) | 0] * 0.55;              // grazing rays reflect instead of transmitting
            const ga = mc[mi + 3] * bodyK, cq = mc[mi + 4] * bodyK, gk = gl * glowK;
            let tr = TL[ti], tg = TL[ti + 1], tb = TL[ti + 2];
            let ar = SL[ti] * ga + CL[ti] * cq + GL[ti] * gk, ag = SL[ti + 1] * ga + CL[ti + 1] * cq + GL[ti + 1] * gk, ab = SL[ti + 2] * ga + CL[ti + 2] * cq + GL[ti + 2] * gk;
            if (hasMix) {
              let mxv = mx < frostK ? frostK : mx; if (mxv > 1) mxv = 1;
              if (mxv > 0.01) {
                tr += (TLB[ti] - tr) * mxv; tg += (TLB[ti + 1] - tg) * mxv; tb += (TLB[ti + 2] - tb) * mxv;
                ar += (SLB[ti] * ga + CLB[ti] * cq + GLB[ti] * gk - ar) * mxv; ag += (SLB[ti + 1] * ga + CLB[ti + 1] * cq + GLB[ti + 1] * gk - ag) * mxv; ab += (SLB[ti + 2] * ga + CLB[ti + 2] * cq + GLB[ti + 2] * gk - ab) * mxv;
              }
            }
            if (clearK > 0) { tr += (1 - tr) * clearK; tg += (1 - tg) * clearK; tb += (1 - tb) * clearK; }
            let rk = 0.10 + hh * 1.25; if (rk > 1) rk = 1; rk *= reflK;      // a hair-thin film mirrors little: tendrils stay gel, not chrome
            r = (r + er * hv) * tr * fr + ar + mc[mi] * rk; gg = (gg + eg * hv) * tg * fr + ag + mc[mi + 1] * rk; b = (b + eb * hv) * tb * fr + ab + mc[mi + 2] * rk;
            if (DBG) { if (DBG === 1) { r = gg = b = hh * 110; } else if (DBG === 2) { r = ar; gg = ag; b = ab; } else if (DBG === 3) { r = mc[mi] * rk; gg = mc[mi + 1] * rk; b = mc[mi + 2] * rk; } else if (DBG === 4) { r = (ps & 255) * tr * fr; gg = ((ps >> 8) & 255) * tg * fr; b = ((ps >> 16) & 255) * tb * fr; } else if (DBG === 5) { r = SL[ti] * ga; gg = CL[ti] * cq; b = GL[ti] * gk; } }
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
