// ─────────────────────────────────────────────────────────────────────────────
//  Colony — one will spread over any number of droplets.
//  Focus, park, swap, rally, re-fuse: a single continuum of intent.
// ─────────────────────────────────────────────────────────────────────────────
import { Organism } from './organism.js';
import { SPACING, AREA_PER_P } from '../sim/physics.js';

export class Colony {
  constructor(world, group, opts = {}) {
    this.W = world; this.group = group;
    this.orgs = []; this.focus = null;
    this.tint = opts.tint || null;
    this.mat = opts.mat ?? 0;
    this.crown = opts.crown || 'sun';
    this.morph = opts.morph || null;
    this.orgOpts = opts.org || {};
    this.peak = 0; this.lost = 0; this.focusFlash = 0;
    this.isPlayer = opts.isPlayer ?? true;
  }
  get mass() { let m = 0; for (const o of this.orgs) if (o.alive) m += o.B.count; return m; }

  spawn(x, y, n, mat = this.mat) {
    const P = this.W.phys;
    const B = P.allocBody(this.group, this.isPlayer ? 'player' : 'ai', mat);
    if (!B) return null;
    B.tint = this.tint;
    let k = 0;
    for (let r = 0; k < n; r++) {
      const m = Math.max(1, Math.floor(2 * Math.PI * r));
      for (let a = 0; a < m && k < n; a++) { const ang = a / m * Math.PI * 2 + r * 0.37; P.spawn(x + Math.cos(ang) * r * SPACING * 0.98, y + Math.sin(ang) * r * SPACING * 0.98, 0, 0, mat, B.id); k++; }
    }
    // aggregates normally appear after a physics step — seed them at birth so controllers see a living body
    B.count = k; B.cx = x; B.cy = y; B.r = Math.sqrt(k * AREA_PER_P / Math.PI); B.alive = true;
    B.minx = x - B.r; B.maxx = x + B.r; B.miny = y - B.r; B.maxy = y + B.r;
    const O = this._make(B);
    if (!this.focus) this.setFocus(O);
    return O;
  }
  _make(B) { const O = new Organism(this.W, B, { colony: this, crown: this.crown, morph: this.morph, ...this.orgOpts }); this.orgs.push(O); return O; }

  adopt(B) {
    if (B.ctrl && B.ctrl.colony === this && B.ctrl.serial === B.serial) return B.ctrl;
    B.tint = this.tint; B.group = this.group;
    return this._make(B);
  }

  setFocus(O) {
    if (!O || !O.alive) return;
    if (this.focus) this.focus.focused = false;
    this.focus = O; O.focused = true; this.focusFlash = 1;
    this.W.onFocus && this.W.onFocus(this, O);
  }
  cycle(dir = 1) {
    const live = this.orgs.filter(o => o.alive);
    if (live.length < 2) return;
    live.sort((a, b) => (a.B.cx - b.B.cx) || (a.B.cy - b.B.cy));      // spatial order: cycling feels like scanning the dish
    const i = live.indexOf(this.focus);
    this.setFocus(live[(i + dir + live.length) % live.length]);
  }

  onSplit(parent, child) {
    const O = this.adopt(child);
    if (parent.ctrl && parent.ctrl.dormant) O.dormant = true;
    O.phi = parent.ctrl ? parent.ctrl.phi : 0;
    if (this.focus && this.focus.B === parent && child.count > parent.count * 1.6) this.setFocus(O);   // the will stays with the larger share
    return O;
  }
  onMerge(keep, gone) {
    const go = this.orgs.find(o => o.B === gone && o.serial === gone.serial);
    if (go) { go.dead = true; if (this.focus === go) { const ko = keep.ctrl && keep.ctrl.colony === this ? keep.ctrl : this.adopt(keep); this.focus = null; this.setFocus(ko); } }
    this.orgs = this.orgs.filter(o => !o.dead && o.B.alive);
  }

  // intent: {x,y} for the focused body · aim: world point · rally: call siblings home
  update(dt, intent, aim, rally) {
    this.focusFlash = Math.max(0, this.focusFlash - dt * 1.5);
    this.orgs = this.orgs.filter(o => o.alive && !o.dead);
    if (this.focus && !this.focus.alive) { const best = this.orgs.slice().sort((a, b) => b.B.count - a.B.count)[0]; this.focus = null; if (best) this.setFocus(best); }
    // the will does not stay behind in a crumb: if what you are steering has dwindled to a speck while a real share of you lies elsewhere, you are the share
    if (this.focus && !this.focus.brain && this.focus.B.count < 6 && this.orgs.length > 1) { let best = null; for (const o of this.orgs) if (o !== this.focus && o.B.count >= 12 && o.B.count > this.focus.B.count * 3 && (!best || o.B.count > best.B.count)) best = o; if (best) this.setFocus(best); }
    const W = this.W;
    for (const O of this.orgs) {
      if (O === this.focus && !O.brain) { O.intent.x = intent ? intent.x : 0; O.intent.y = intent ? intent.y : 0; O.aim = aim || null; }
      else if (!O.brain) {
        O.intent.x = 0; O.intent.y = 0; O.aim = null;
        // survival instinct: unpiloted siblings shy away from blades, grinders and wells
        const hz = W.hazards ? W.hazards() : null;
        if (hz && !(O.budT > 0)) for (const h of hz) {
          const dx = O.B.cx - h.x, dy = O.B.cy - h.y, d = Math.hypot(dx, dy) + 1; const reach = (h.r || 60) + O.B.r + 26;
          if (d < reach) { const k = (1 - d / reach) * 1.6; O.intent.x += dx / d * k; O.intent.y += dy / d * k; }
        }
        const im = Math.hypot(O.intent.x, O.intent.y); if (im > 1) { O.intent.x /= im; O.intent.y /= im; }
        if (rally && this.focus) { O.rallyTo = this.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }
      }
      O.update(dt);
    }
    if (rally && this.focus) this.focus.B.fuseT = Math.min(this.focus.B.fuseT, 0.05);
    const m = this.mass; if (m > this.peak) this.peak = m;
  }
  post(dt) { for (const O of this.orgs) if (O.alive) O.post(dt); }
}
