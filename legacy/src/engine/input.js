// ─────────────────────────────────────────────────────────────────────────────
//  Unified intent input. One vocabulary across touch, mouse, keys, pads:
//   • flow   — floating anchor stick (touch/mouse drag anywhere) · WASD · pad
//   • dart   — whip-flick release · Space · pad A
//   • bud    — second finger tap / right-click (aims at the point) · E · pad X
//   • rally  — pinch · hold Q/R · middle mouse · pad B
//   • focus  — tap a droplet · Tab · pad bumpers
//   • swell  — hold F / two-finger hold · pad Y   (inflate an air cavity)
// ─────────────────────────────────────────────────────────────────────────────

const STICK_R = 64;      // css px radius of the floating stick
const DEAD = 0.07;

export class Input {
  constructor(el) {
    this.el = el;
    this.move = { x: 0, y: 0 };
    this.stick = { active: false, ax: 0, ay: 0, kx: 0, ky: 0, t: 0, id: -1 };
    this.keys = new Set();
    this.events = [];
    this.rallyHeld = false; this.swellHeld = false;
    this.device = 'mouse';
    this.mouse = { x: 0, y: 0, inside: false, t: 0 };
    this.pointers = new Map();
    this.pinch0 = 0;
    this.lastMoveDir = { x: 1, y: 0 };
    this.keyMove = { x: 0, y: 0 };
    this.padMove = { x: 0, y: 0 };
    this.padPrev = [];
    this.enabled = true;
    this.anyInput = false;
    this.lastActivity = performance.now();
    this.hist = [];
    this._bind();
  }

  _bind() {
    const el = this.el;
    const opt = { passive: false };
    el.addEventListener('pointerdown', e => this._down(e), opt);
    window.addEventListener('pointermove', e => this._moveEv(e), opt);
    window.addEventListener('pointerup', e => this._up(e), opt);
    window.addEventListener('pointercancel', e => this._up(e, true), opt);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); this.events.push({ type: 'wheel', d: Math.sign(e.deltaY) }); }, opt);
    window.addEventListener('keydown', e => this._key(e, true));
    window.addEventListener('keyup', e => this._key(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.stick.active = false; this.rallyHeld = false; this.swellHeld = false; });
  }

  _activity() { this.lastActivity = performance.now(); this.anyInput = true; }

  _down(e) {
    e.preventDefault();
    this._activity();
    try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    this.device = touch ? 'touch' : 'mouse';
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), button: e.button, touch, hist: [[e.clientX, e.clientY, performance.now()]] };
    this.pointers.set(e.pointerId, p);
    this.events.push({ type: 'press', x: e.clientX, y: e.clientY, button: e.button, touch });
    if (!this.enabled) return;
    if (!touch && e.button === 2) { p.role = 'bud'; return; }
    if (!touch && e.button === 1) { p.role = 'rally'; this.rallyHeld = true; return; }
    if (touch && this.stick.active) {
      // second finger: bud / pinch
      p.role = 'second';
      const s = [...this.pointers.values()].find(q => q.role === 'stick');
      if (s) this.pinch0 = Math.hypot(s.x - p.x, s.y - p.y);
      return;
    }
    p.role = 'stick';
    const S = this.stick;
    S.active = true; S.id = e.pointerId; S.ax = e.clientX; S.ay = e.clientY; S.kx = e.clientX; S.ky = e.clientY; S.t = performance.now();
  }

  _moveEv(e) {
    const p = this.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; this.mouse.t = performance.now(); }
    if (!p) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const last = evs[evs.length - 1] || e;
    p.x = last.clientX; p.y = last.clientY;
    for (const c of evs) p.hist.push([c.clientX, c.clientY, performance.now()]);
    if (p.hist.length > 24) p.hist.splice(0, p.hist.length - 24);
    this._activity();
    if (p.role === 'stick') {
      const S = this.stick;
      S.kx = p.x; S.ky = p.y;
      const dx = S.kx - S.ax, dy = S.ky - S.ay; const d = Math.hypot(dx, dy);
      const R = STICK_R * 1.15;
      if (d > R) { S.ax = S.kx - dx / d * R; S.ay = S.ky - dy / d * R; } // anchor trails the thumb
    }
    if (p.role === 'second') {
      const s = [...this.pointers.values()].find(q => q.role === 'stick');
      if (s && this.pinch0 > 0) {
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < this.pinch0 * 0.62 && !p.pinched) { p.pinched = true; this.events.push({ type: 'rallyPulse' }); this.rallyHeld = true; }
      }
    }
  }

  _flick(p) {
    const now = performance.now();
    const h = p.hist; if (h.length < 2) return null;
    let k = h.length - 1; while (k > 0 && now - h[k][2] < 85) k--;
    const [x0, y0, t0] = h[k], [x1, y1] = [p.x, p.y];
    const dt = Math.max(16, now - t0);
    const vx = (x1 - x0) / dt, vy = (y1 - y0) / dt;
    const sp = Math.hypot(vx, vy);
    const thresh = p.touch ? 0.95 : 1.25;  // css px / ms
    if (sp > thresh && Math.hypot(x1 - x0, y1 - y0) > 26) return { x: vx / sp, y: vy / sp, power: Math.min(1.6, sp / thresh) };
    return null;
  }

  _up(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const dur = performance.now() - p.t0;
    const moved = Math.hypot(p.x - p.x0, p.y - p.y0);
    if (cancel) { if (p.role === 'stick') this.stick.active = false; return; }
    if (p.role === 'stick') {
      this.stick.active = false;
      const f = this._flick(p);
      if (f) this.events.push({ type: 'dart', x: f.x, y: f.y, power: f.power });
      else if (dur < 230 && moved < 12) this.events.push({ type: 'tap', x: p.x, y: p.y, touch: p.touch });
    } else if (p.role === 'second') {
      if (!p.pinched && dur < 280 && moved < 22) this.events.push({ type: 'bud', x: p.x, y: p.y, aimed: true });
      if (p.pinched) this.rallyHeld = false;
    } else if (p.role === 'bud') {
      this.events.push({ type: 'bud', x: p.x, y: p.y, aimed: true });
    } else if (p.role === 'rally') {
      this.rallyHeld = false;
    }
  }

  _key(e, down) {
    const k = e.code;
    if (down) this._activity();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k)) e.preventDefault();
    if (down && !this.keys.has(k)) {
      this.device = 'keyboard';
      this.events.push({ type: 'key', code: k });
      if (k === 'Space') this.events.push({ type: 'dart', key: true });
      if (k === 'KeyE' || k === 'ShiftLeft' || k === 'ShiftRight') this.events.push({ type: 'bud', key: true });
      if (k === 'Tab') this.events.push({ type: 'focusNext', dir: e.shiftKey ? -1 : 1 });
      if (k === 'Escape' || k === 'KeyP') this.events.push({ type: 'pause' });
      if (k === 'Enter') this.events.push({ type: 'confirm' });
    }
    if (down) this.keys.add(k); else this.keys.delete(k);
    this.rallyHeld = this.keys.has('KeyQ') || this.keys.has('KeyR') || [...this.pointers.values()].some(p => p.role === 'rally' || p.pinched);
    this.swellHeld = this.keys.has('KeyF');
  }

  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = pads && [...pads].find(p => p && p.connected);
    this.padMove.x = 0; this.padMove.y = 0;
    if (!g) return;
    let x = g.axes[0] || 0, y = g.axes[1] || 0;
    if (g.buttons[14]?.pressed) x = -1; if (g.buttons[15]?.pressed) x = 1;
    if (g.buttons[12]?.pressed) y = -1; if (g.buttons[13]?.pressed) y = 1;
    const m = Math.hypot(x, y);
    if (m > 0.15) { const s = Math.min(1, (m - 0.15) / 0.8) / m; this.padMove.x = x * s; this.padMove.y = y * s; this.device = 'pad'; this._activity(); }
    const b = g.buttons.map(bt => bt.pressed);
    const edge = (i) => b[i] && !this.padPrev[i];
    if (edge(0)) this.events.push({ type: 'dart', key: true });
    if (edge(2)) this.events.push({ type: 'bud', key: true });
    if (edge(4)) this.events.push({ type: 'focusNext', dir: -1 });
    if (edge(5)) this.events.push({ type: 'focusNext', dir: 1 });
    if (edge(9)) this.events.push({ type: 'pause' });
    if (edge(0) || edge(2)) this.events.push({ type: 'confirm' });
    if (b.some(Boolean)) { this.device = 'pad'; this._activity(); }
    this.padRally = !!b[1];
    this.padSwell = !!b[3];
    this.padPrev = b;
  }

  // called once per frame
  poll() {
    this._pad();
    const K = this.keys;
    let kx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let ky = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
    if (kx && ky) { kx *= Math.SQRT1_2; ky *= Math.SQRT1_2; }
    // keys ramp quickly (analogue feel without sluggishness)
    const ramp = 0.35;
    this.keyMove.x += (kx - this.keyMove.x) * ramp; this.keyMove.y += (ky - this.keyMove.y) * ramp;
    if (!kx && Math.abs(this.keyMove.x) < 0.02) this.keyMove.x = 0;
    if (!ky && Math.abs(this.keyMove.y) < 0.02) this.keyMove.y = 0;
    let mx = 0, my = 0;
    const S = this.stick;
    if (S.active) {
      let dx = (S.kx - S.ax) / STICK_R, dy = (S.ky - S.ay) / STICK_R;
      const m = Math.hypot(dx, dy);
      if (m < DEAD) { dx = 0; dy = 0; }
      else { const c = Math.min(1, (m - DEAD) / (1 - DEAD)); dx = dx / m * c; dy = dy / m * c; }
      mx = dx; my = dy;
    }
    if (Math.abs(this.keyMove.x) + Math.abs(this.keyMove.y) > 0.01) { mx = this.keyMove.x; my = this.keyMove.y; }
    if (Math.abs(this.padMove.x) + Math.abs(this.padMove.y) > 0.01) { mx = this.padMove.x; my = this.padMove.y; }
    if (!this.enabled) { mx = 0; my = 0; }
    this.move.x = mx; this.move.y = my;
    const m = Math.hypot(mx, my);
    if (m > 0.2) { this.lastMoveDir.x = mx / m; this.lastMoveDir.y = my / m; }
    this.rally = this.rallyHeld || this.padRally;
    this.swell = this.swellHeld || this.padSwell || [...this.pointers.values()].filter(p => p.role === 'second' && !p.pinched && performance.now() - p.t0 > 420).length > 0;
    const ev = this.events; this.events = [];
    return ev;
  }

  stickVisual() { return this.stick; }
  get stickRadius() { return STICK_R; }
}
