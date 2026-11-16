// ─────────────────────────────────────────────────────────────────────────────
//  Colony — one player's many bodies. A single continuum of will spread over
//  any number of droplets: focus, park, swap, rally, re-fuse.
// ─────────────────────────────────────────────────────────────────────────────
import { Organism } from './organism.js';
import { SPACING, AREA_PER_P } from '../engine/physics.js';

export class Colony {
  constructor(game, group, opts = {}) {
    this.G = game; this.group = group;
    this.orgs = [];
    this.focus = null;
    this.tint = opts.tint || null;
    this.layer = opts.layer ?? 0;
    this.mat = opts.mat ?? 0;
    this.input = opts.input || null;      // which input slot drives this colony
    this.color = opts.color || [1.0, 0.62, 0.42];
    this.peak = 0;
    this.lost = 0;
    this.focusFlash = 0;
  }
  get mass() { let m = 0; for (const o of this.orgs) if (o.alive) m += o.B.count; return m; }
  get main() { return this.focus; }

  spawn(x, y, n, mat = this.mat) {
    const P = this.G.phys;
    const B = P.allocBody(this.group, 'player', mat);
    B.tint = this.tint; B.layer = this.layer;
    let k = 0;
    for (let r = 0; k < n; r++) {
      const m = Math.max(1, Math.floor(2 * Math.PI * r));
      for (let a = 0; a < m && k < n; a++) {
        const ang = a / m * Math.PI * 2 + r * 0.37;
        P.spawn(x + Math.cos(ang) * r * SPACING * 0.98, y + Math.sin(ang) * r * SPACING * 0.98, 0, 0, mat, B.id); k++;
      }
    }
    // aggregates are normally computed after a physics step — seed them at birth
    B.count = k; B.cx = x; B.cy = y; B.r = Math.sqrt(k * AREA_PER_P / Math.PI); B.alive = true;
    B.minx = x - B.r; B.maxx = x + B.r; B.miny = y - B.r; B.maxy = y + B.r;
    const O = new Organism(this.G, B, { colony: this });
    this.orgs.push(O);
    this.setFocus(O);
    return O;
  }

  adopt(B) {
    if (B.ctrl && B.ctrl.colony === this) return B.ctrl;
    B.tint = this.tint; B.layer = this.layer;
    const O = new Organism(this.G, B, { colony: this });
    this.orgs.push(O);
    return O;
  }

  setFocus(O) {
    if (!O || !O.alive) return;
    if (this.focus) this.focus.focused = false;
    this.focus = O; O.focused = true;
    this.focusFlash = 1;
    this.G.onFocus && this.G.onFocus(this, O);
  }

  cycle(dir = 1) {
    const live = this.orgs.filter(o => o.alive);
    if (live.length < 2) return;
    // order by position (left→right, then top→bottom) so cycling feels spatial
    live.sort((a, b) => (a.B.cx - b.B.cx) || (a.B.cy - b.B.cy));
    const i = live.indexOf(this.focus);
    this.setFocus(live[(i + dir + live.length) % live.length]);
  }

  // called by physics split callback
  onSplit(parent, child) {
    const O = this.adopt(child);
    if (parent.ctrl && parent.ctrl.dormant) O.dormant = true;
    // if the focused body shrank below its sibling, keep focus on the bigger piece
    if (this.focus && this.focus.B === parent && child.count > parent.count * 1.6) this.setFocus(O);
    return O;
  }
  onMerge(keep, gone) {
    const go = this.orgs.find(o => o.B === gone);
    if (go) { go.dead = true; if (this.focus === go) { const ko = keep.ctrl && keep.ctrl.colony === this ? keep.ctrl : this.adopt(keep); this.setFocus(ko); } }
    this.orgs = this.orgs.filter(o => !o.dead && o.B.alive);
  }

  update(dt, intent, rally) {
    this.focusFlash = Math.max(0, this.focusFlash - dt * 1.5);
    this.orgs = this.orgs.filter(o => o.alive && !o.dead);
    if (this.focus && !this.focus.alive) {
      // focus lost (consumed / evaporated): hand it to the largest survivor
      const best = this.orgs.slice().sort((a, b) => b.B.count - a.B.count)[0];
      this.focus = null;
      if (best) this.setFocus(best);
    }
    for (const O of this.orgs) {
      if (O === this.focus) { O.intent.x = intent.x; O.intent.y = intent.y; }
      else {
        O.intent.x = 0; O.intent.y = 0;
        // survival instinct: unpiloted siblings shy away from blades, grinders and wells
        const hz = this.G.hazards ? this.G.hazards() : null;
        if (hz) for (const h of hz) {
          const dx = O.B.cx - h.x, dy = O.B.cy - h.y, d = Math.hypot(dx, dy) + 1;
          const reach = (h.r || 60) + O.B.r + 90;
          if (d < reach) { const k = (1 - d / reach) * 1.2; O.intent.x += dx / d * k; O.intent.y += dy / d * k; }
        }
        const im = Math.hypot(O.intent.x, O.intent.y); if (im > 1) { O.intent.x /= im; O.intent.y /= im; }
        if (rally && this.focus) {
          O.rallyTo = this.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05);
        }
      }
      O.update(dt);
    }
    if (rally && this.focus) this.focus.B.fuseT = Math.min(this.focus.B.fuseT, 0.05);
    const m = this.mass; if (m > this.peak) this.peak = m;
  }
}
