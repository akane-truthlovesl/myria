// ─────────────────────────────────────────────────────────────────────────────
//  Brains — small, legible minds for the other organisms of the slide.
//  Each species has one obvious desire you can read from its body language:
//  grazers drift after light and bolt from anything bigger; hunters stalk what
//  they can swallow and lance when lined up; drifters (oil) just wander.
// ─────────────────────────────────────────────────────────────────────────────
import { MAT } from '../sim/materials.js';

export const SPECIES = {
  grazer: { mat: MAT.RIVAL, crown: 'cilia', speed: 0.62, tint: { id: 'grazer', absorb: [0.95, 0.30, 0.08], emit: [0.35, 0.85, 1.0], glow: 0.5, halo: 0.28 }, name: 'Grazer' },
  hunter: { mat: MAT.RIVAL, crown: 'whips', speed: 0.74, tint: { id: 'hunter', absorb: [0.30, 0.95, 0.20], emit: [0.86, 0.45, 1.0], glow: 0.6, halo: 0.28 }, name: 'Lancer' },
  thorn: { mat: MAT.THORN, crown: 'thorns', speed: 0.5, tint: null, name: 'Thornback' },
  oil: { mat: MAT.OIL, crown: 'none', speed: 0.3, tint: null, name: 'Oil' },
  puffer: { mat: MAT.RIVAL, crown: 'cilia', speed: 0.45, tint: { id: 'puffer', absorb: [0.2, 0.5, 0.9], emit: [1.0, 0.9, 0.4], glow: 0.55, halo: 0.28 }, name: 'Puffer' },
};

export class Brain {
  constructor(kind) { this.kind = kind; this.t = Math.random() * 3; this.wx = 0; this.wy = 0; this.wt = 0; this.state = 'wander'; this.dartT = 1 + Math.random() * 2; }
  think(O, dt) {
    const W = O.W, B = O.B; this.t += dt; this.dartT -= dt;
    let ix = 0, iy = 0;
    // read the neighbourhood: nearest bigger body (threat) and nearest smaller one (prey)
    let threat = null, td = 1e9, prey = null, pd = 1e9;
    for (const C of W.colonies) for (const Q of C.orgs) {
      if (!Q.alive || Q === O || C.group === B.group) continue;
      if (Q.stealth) continue;                                   // a veiled body is a stone to them
      const d = Math.hypot(Q.B.cx - B.cx, Q.B.cy - B.cy) - Q.B.r - B.r;
      const seems = Q.B.count * (1 + 1.3 * (Q.B.inflate || 0));          // they judge by silhouette: a swollen body reads as a giant
      if (seems > B.count * 1.15 && d < td) { td = d; threat = Q; }
      else if (seems * 1.15 < B.count && d - (Q.ripe ? 150 : 0) < pd) { pd = d - (Q.ripe ? 150 : 0); prey = Q; }        // a ripe decoy smells like the easiest meal in the dish
    }
    const k = this.kind;
    if (threat && td < (k === 'hunter' ? 90 : 150) && k !== 'oil' && k !== 'thorn') {
      const dx = B.cx - threat.B.cx, dy = B.cy - threat.B.cy, d = Math.hypot(dx, dy) + 1; ix = dx / d; iy = dy / d; this.state = 'flee';
      if (td < 30 && this.dartT <= 0 && B.count > 14) { O.dart(ix, iy, 1); this.dartT = 2.4; }
    } else if (k === 'hunter' && prey && pd < 270) {
      const dx = prey.B.cx - B.cx, dy = prey.B.cy - B.cy, d = Math.hypot(dx, dy) + 1; ix = dx / d; iy = dy / d; this.state = 'hunt';
      // the lance: a visible coil, then a strike — fair warning every time
      if (pd < 170 && pd > 40 && this.dartT <= 0) { this.coil = (this.coil || 0) + dt; O.coil = Math.min(1, this.coil / 0.55); ix *= 0.1; iy *= 0.1; if (this.coil > 0.55) { O.dart(dx, dy, 1.25); O.coil = 0; this.coil = 0; this.dartT = 2.6; } }
      else { this.coil = 0; O.coil = 0; }
    } else if (k === 'grazer' || k === 'puffer') {
      let best = null, bd = 420; for (const p of W.pickups) { if (p.dead || p.held) continue; const d = Math.hypot(p.x - B.cx, p.y - B.cy); if (d < bd) { bd = d; best = p; } }
      if (best) { ix = (best.x - B.cx) / bd; iy = (best.y - B.cy) / bd; this.state = 'graze'; if (bd < B.r * 0.9 + best.r) best.absorb(O, null); }
    }
    if (!ix && !iy) {         // wander: slow loops around a home-ish point
      this.wt -= dt; if (this.wt <= 0) { this.wt = 1.5 + Math.random() * 2.5; const a = Math.random() * 6.28; this.wx = Math.cos(a); this.wy = Math.sin(a); }
      ix = this.wx * 0.45; iy = this.wy * 0.45; this.state = 'wander';
    }
    // everyone respects walls and hazards a little
    const d = W.phys.sampleSDF(B.cx + ix * 60, B.cy + iy * 60);
    if (d < B.r * 0.6) { const n = W.phys.sdfNormal(B.cx, B.cy, N2); ix += n[0] * 0.9; iy += n[1] * 0.9; }
    for (const h of W.hazards()) { const dx = B.cx - h.x, dy = B.cy - h.y, dd = Math.hypot(dx, dy) + 1; const reach = h.r + B.r + 70; if (dd < reach) { const s = (1 - dd / reach) * 1.6; ix += dx / dd * s; iy += dy / dd * s; } }
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    O.intent.x += (ix - O.intent.x) * Math.min(1, dt * 5); O.intent.y += (iy - O.intent.y) * Math.min(1, dt * 5);
  }
}
const N2 = [0, 0];
