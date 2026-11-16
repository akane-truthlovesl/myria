// ─────────────────────────────────────────────────────────────────────────────
//  Sprites — moving solids (gates, crushers, gears) shaded once with the same
//  bevel-and-lamp model as the room's walls, then stamped each frame.
//  What you see is still exactly what the solver collides with: the sprite is
//  rendered from the very shape record the physics uses.
// ─────────────────────────────────────────────────────────────────────────────
import { shapeSDF } from '../sim/physics.js';
import { SURF } from '../sim/materials.js';
import { sat, vnoise } from '../core/util.js';

const KEY = (() => { const k = [-0.45, -0.70, 0.56]; const l = Math.hypot(...k); return k.map(v => v / l); })();
const RIM = [0.50, 0.86, 0.98];

// shade a physics shape (in its own frame: centred, angle 0) into a sprite at `z` px per world unit
export function solidSprite(S, z, o = {}) {
  const ext = (S.type === 0 ? S.r : S.type === 1 ? S.hl + S.r : S.type === 2 ? Math.max(S.hw, S.hh) * 1.0 : S.R + S.r) + (o.teeth ? o.toothH || 7 : 0) + 3;
  const hw = S.type === 2 ? S.hw + 3 : ext, hh = S.type === 2 ? S.hh + 3 : S.type === 1 ? S.r + 3 : ext;
  const w = Math.max(4, Math.ceil(hw * 2 * z)), h = Math.max(4, Math.ceil(hh * 2 * z));
  const px = new Uint32Array(w * h), al = new Uint8Array(w * h);
  const T = { ...S, x: 0, y: 0, angle: 0 }; const out = new Float32Array(3);
  const m = o.surf ?? S.surf; const teeth = o.teeth || 0, toothH = o.toothH || 7;
  const tint = o.tint || null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const wx = (i + 0.5) / z - hw, wy = (j + 0.5) / z - hh;
    shapeSDF(T, wx, wy, 1, 0, out);
    let d = out[0]; const gx = out[1], gy = out[2];
    if (teeth) { const a = Math.atan2(wy, wx); const tooth = Math.pow(Math.abs(Math.sin(a * teeth * 0.5)), 0.7); d -= tooth * toothH; }
    const cov = sat(0.5 - d * z); if (cov <= 0) continue;
    const depth = d < 0 ? -d : 0; const tb = sat(depth / 8); const slope = (1 - tb) * (1 - tb) * 1.55; const il = 1 / Math.sqrt(slope * slope + 1);
    const Nx = gx * slope * il, Ny = gy * slope * il, Nz = il;
    let cr, cg, cb, gloss = 0.5, rimK = 1, er = 0, eg = 0, eb = 0;
    if (m === SURF.GRIT) { const n = vnoise(wx * 0.5, wy * 0.5); cr = 0.15 + 0.1 * n; cg = 0.11 + 0.08 * n; cb = 0.10 + 0.07 * n; gloss = 0.15; rimK = 0.5; const e = Math.exp(-depth / 3); er = 0.55 * e; eg = 0.2 * e; eb = 0.05 * e; }
    else if (m === SURF.GLASS) { const band = Math.exp(-depth / 16); cr = 0.05 + 0.2 * band; cg = 0.09 + 0.33 * band; cb = 0.12 + 0.42 * band; gloss = 1; rimK = 1.6; }
    else if (m === SURF.BOUNCE) { cr = 0.03; cg = 0.34; cb = 0.42; gloss = 0.8; const e = Math.exp(-depth / 3.5); eg = 0.5 * e; eb = 0.6 * e; }
    else if (m === SURF.RESIN) { cr = 0.4; cg = 0.18; cb = 0.03; gloss = 0.7; er = 0.1; eg = 0.04; }
    else { const br = vnoise(wx * 0.55, wy * 0.04); cr = 0.17 * (0.7 + 0.5 * br); cg = 0.20 * (0.7 + 0.5 * br); cb = 0.25 * (0.7 + 0.5 * br); gloss = 0.7; }   // METAL
    if (tint) { cr = cr * 0.5 + tint[0] * 0.2; cg = cg * 0.5 + tint[1] * 0.2; cb = cb * 0.5 + tint[2] * 0.2; }
    const diff = Math.max(0, Nx * KEY[0] + Ny * KEY[1] + Nz * KEY[2]);
    const ndh = Math.max(0, Nx * KEY[0] * 0.5 + Ny * KEY[1] * 0.5 + Nz * (KEY[2] + 1) * 0.5) / 0.88;
    const spec = Math.pow(Math.min(1, ndh), 26) * gloss * 0.38; const lip = Math.exp(-depth / 1.6) * 0.085 * rimK * (0.45 + 0.9 * diff);
    const r = cr * (0.34 + 0.72 * diff) + RIM[0] * (spec + lip) + er, g = cg * (0.34 + 0.72 * diff) + RIM[1] * (spec + lip) + eg, b = cb * (0.34 + 0.72 * diff) + RIM[2] * (spec + lip) + eb;
    px[j * w + i] = (Math.min(255, b * 255) | 0) << 16 | (Math.min(255, g * 255) | 0) << 8 | (Math.min(255, r * 255) | 0);
    al[j * w + i] = (cov * 255) | 0;
  }
  return { w, h, px, al, z };
}
