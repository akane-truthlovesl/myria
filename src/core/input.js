// ─────────────────────────────────────────────────────────────────────────────
//  Input — one vocabulary of intent across mouse, touch, keys and pads.
//
//   flow    mouse: the creature follows the pointer (rest by resting the pointer on it)
//           touch: a translucent anchor wakes under the thumb — drag to steer
//           keys : WASD / arrows                · pad: left stick
//   dart    click · tap · flick · Space · pad A   (hold to coil for a longer lance)
//   bud     right-click · second-finger tap · E   · pad X   (a sibling leaps toward the point)
//   rally   hold Q / middle button · pinch        · pad B   (siblings come home and fuse)
//   focus   click / tap a sibling · Tab · wheel   · pad bumpers
//
//  Nothing here knows about the game: it turns hardware into a small `ctl`
//  record that the world consumes each tick.
// ─────────────────────────────────────────────────────────────────────────────
const STICK_R = 62;          // css px radius of the floating touch stick
const DEAD = 0.08;
const TILT_FULL = 16, TILT_DEAD = 0.16;      // degrees of tip for full speed · fraction of it that still counts as level

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.events = [];
    this.device = 'mouse';
    this.mouse = { x: 0, y: 0, inside: false, down: false, t0: 0, moved: 0, follow: true };
    this.stick = { active: false, ax: 0, ay: 0, kx: 0, ky: 0, id: -1, t0: 0 };
    // two on one glass: a mode with a second player sets split(x, y) → 1 | 2, and a touch that begins in player two's half wakes player two's stick
    this.split = null; this.stick2 = { active: false, ax: 0, ay: 0, kx: 0, ky: 0, id: -1, t0: 0 }; this.swell2 = false;
    // two on one keyboard (a mode sets keysSplit): player one has the arrows and Enter (or / or the right Shift/Ctrl) to dart, player two W A S D and Space
    this.keysSplit = false; this.keyT1 = 0;
    this.pointers = new Map();
    this.pinch0 = 0; this.rallyHeld = false; this.rallyPtr = false;
    this.keyMove = { x: 0, y: 0 }; this.padMove = { x: 0, y: 0 }; this.padPrev = []; this.padRally = false;
    this.enabled = true; this.lastActivity = 0; this.any = false;
    this.charge = 0;         // seconds the dart button has been held (coil)
    this.keyT0 = 0; this.padT0 = 0;
    this.tilt = { on: false, seen: false, zero: null, x: 0, y: 0, t: -1e9 };       // optional gyro: tip the device like a dish
    this._bind();
  }

  _bind() {
    const el = this.el, opt = { passive: false };
    el.addEventListener('pointerdown', e => this._down(e), opt);
    window.addEventListener('pointermove', e => this._move(e), opt);
    window.addEventListener('pointerup', e => this._up(e), opt);
    window.addEventListener('pointercancel', e => this._up(e, true), opt);
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.mouse.inside = false; });
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') this.mouse.inside = true; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); this.events.push({ type: 'cycle', dir: Math.sign(e.deltaY) || 1 }); }, opt);
    window.addEventListener('keydown', e => this._key(e, true));
    window.addEventListener('keyup', e => this._key(e, false));
    window.addEventListener('blur', () => { this.keyT0 = 0; this.keyT1 = 0; this.padT0 = 0; this.rmb = 0; this.swellKey = false; this.keys.clear(); this.pointers.clear(); this.stick.active = false; this.stick2.active = false; this.rallyHeld = false; this.rallyPtr = false; this.mouse.down = false; this.mouse.inside = false; });
  }
  _act() { this.lastActivity = performance.now(); this.any = true; }

  _down(e) {
    e.preventDefault(); this._act();
    try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    this.device = touch ? 'touch' : 'mouse';
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), button: e.button, touch, hist: [[e.clientX, e.clientY, performance.now()]] };
    this.pointers.set(e.pointerId, p);
    this.events.push({ type: 'press', x: e.clientX, y: e.clientY, button: e.button, touch });
    if (!touch) {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; this.mouse.follow = true;
      if (e.button === 2) { p.role = 'bud'; this.rmb = performance.now(); return; }
      if (e.button === 1) { p.role = 'rally'; this.rallyPtr = true; return; }
      p.role = 'dart'; this.mouse.down = true; this.mouse.t0 = performance.now();
      return;
    }
    if (this.split && this.split(e.clientX, e.clientY) === 2) {          // player two's half of the glass
      if (this.stick2.active) { p.role = 'second2'; return; }
      p.role = 'stick2'; const S2 = this.stick2; S2.active = true; S2.id = e.pointerId; S2.ax = S2.kx = e.clientX; S2.ay = S2.ky = e.clientY; S2.t0 = performance.now(); return;
    }
    if (this.stick.active) {            // second finger: bud (tap) or rally (pinch)
      p.role = 'second';
      const s = [...this.pointers.values()].find(q => q.role === 'stick');
      if (s) this.pinch0 = Math.hypot(s.x - p.x, s.y - p.y);
      return;
    }
    p.role = 'stick';
    const S = this.stick; S.active = true; S.id = e.pointerId; S.ax = S.kx = e.clientX; S.ay = S.ky = e.clientY; S.t0 = performance.now();
  }

  _move(e) {
    if (e.pointerType === 'mouse') {
      const m = this.mouse; const d = Math.hypot(e.clientX - m.x, e.clientY - m.y);
      m.x = e.clientX; m.y = e.clientY; m.inside = true;
      if (d > 0.5) { m.follow = true; this.device = 'mouse'; this._act(); }
    }
    const p = this.pointers.get(e.pointerId); if (!p) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const c of evs) p.hist.push([c.clientX, c.clientY, performance.now()]);
    if (p.hist.length > 24) p.hist.splice(0, p.hist.length - 24);
    p.x = e.clientX; p.y = e.clientY; this._act();
    if (p.role === 'stick' || p.role === 'stick2') {
      const S = p.role === 'stick' ? this.stick : this.stick2; S.kx = p.x; S.ky = p.y;
      const dx = S.kx - S.ax, dy = S.ky - S.ay, d = Math.hypot(dx, dy), R = STICK_R * 1.15;
      if (d > R) { S.ax = S.kx - dx / d * R; S.ay = S.ky - dy / d * R; }      // the anchor trails the thumb
    } else if (p.role === 'second') {
      const s = [...this.pointers.values()].find(q => q.role === 'stick');
      if (s && this.pinch0 > 0 && Math.hypot(s.x - p.x, s.y - p.y) < this.pinch0 * 0.62 && !p.pinched) { p.pinched = true; this.rallyPtr = true; }
    }
  }

  _flick(p) {
    const now = performance.now(), h = p.hist; if (h.length < 2) return null;
    let k = h.length - 1; while (k > 0 && now - h[k][2] < 85) k--;
    const dt = Math.max(16, now - h[k][2]); const vx = (p.x - h[k][0]) / dt, vy = (p.y - h[k][1]) / dt; const sp = Math.hypot(vx, vy);
    if (sp > 0.95 && Math.hypot(p.x - h[k][0], p.y - h[k][1]) > 26) return { x: vx / sp, y: vy / sp, power: Math.min(1.6, sp / 0.95) };
    return null;
  }

  _up(e, cancel) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    this.pointers.delete(e.pointerId);
    const dur = performance.now() - p.t0, moved = Math.hypot(p.x - p.x0, p.y - p.y0);
    if (p.role === 'dart') { this.mouse.down = false; if (!cancel) this.events.push({ type: 'click', x: p.x, y: p.y, hold: dur / 1000 }); this.charge = 0; return; }
    if (p.role === 'rally' || p.pinched) this.rallyPtr = [...this.pointers.values()].some(q => q.role === 'rally' || q.pinched);
    if (cancel) { if (p.role === 'stick') this.stick.active = false; if (p.role === 'stick2') this.stick2.active = false; return; }
    if (p.role === 'stick2') {
      this.stick2.active = false; const f = this._flick(p);
      if (f) this.events.push({ type: 'dartDir2', x: f.x, y: f.y, power: f.power }); else if (dur < 240 && moved < 12) this.events.push({ type: 'tap2', x: p.x, y: p.y });
      return;
    }
    if (p.role === 'second2') return;
    if (p.role === 'stick') {
      this.stick.active = false;
      const f = this._flick(p);
      if (f) this.events.push({ type: 'dartDir', x: f.x, y: f.y, power: f.power });
      else if (dur < 240 && moved < 12) this.events.push({ type: 'tap', x: p.x, y: p.y });
    } else if (p.role === 'second') { if (!p.pinched && dur < 300 && moved < 24) this.events.push({ type: 'budAt', x: p.x, y: p.y }); }
    else if (p.role === 'bud') { if (dur < 260) this.events.push({ type: 'budAt', x: p.x, y: p.y }); this.rmb = 0; }
  }

  _key(e, down) {
    const k = e.code;
    if (down) this._act();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k)) e.preventDefault();
    if (down && !this.keys.has(k)) {
      this.events.push({ type: 'key', code: k });
      if (k === 'Space') this.keyT0 = performance.now();          // a dart fires on release: a tap is a dart, a held key coils a lance (as the mouse button does)
      if (k === 'KeyE' || k === 'ShiftLeft' || k === 'ShiftRight') this.events.push({ type: 'budKey' });
      if (k === 'Tab') this.events.push({ type: 'cycle', dir: e.shiftKey ? -1 : 1 });
      if (k === 'Escape' || k === 'KeyP') this.events.push({ type: 'pause' });
      if (k === 'Enter') this.events.push({ type: 'confirm' });
      if (!this.keysOff && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { this.device = 'keyboard'; this.mouse.follow = false; }
      if (this.keysSplit && k.startsWith('Arrow')) { this.device = 'keyboard'; this.mouse.follow = false; }
      if (this.keysSplit && DART1.includes(k)) this.keyT1 = performance.now();
    }
    if (!down && this.keysSplit && DART1.includes(k) && this.keyT1) { this.events.push({ type: 'dartKey', p1: true, hold: (performance.now() - this.keyT1) / 1000 }); this.keyT1 = 0; }
    if (!down && k === 'Space' && this.keyT0) { this.events.push({ type: 'dartKey', hold: (performance.now() - this.keyT0) / 1000 }); this.keyT0 = 0; }
    if (down) this.keys.add(k); else this.keys.delete(k);
    this.rallyHeld = this.keys.has('KeyQ') || this.keys.has('KeyR'); this.swellKey = this.keys.has('KeyF');
  }

  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = pads && [...pads].find(p => p && p.connected);
    this.padMove.x = 0; this.padMove.y = 0; this.padRally = false;
    if (!g) return;
    let x = g.axes[0] || 0, y = g.axes[1] || 0;
    if (g.buttons[14]?.pressed) x = -1; if (g.buttons[15]?.pressed) x = 1; if (g.buttons[12]?.pressed) y = -1; if (g.buttons[13]?.pressed) y = 1;
    const m = Math.hypot(x, y);
    if (m > 0.16) { const s = Math.min(1, (m - 0.16) / 0.8) / m; this.padMove.x = x * s; this.padMove.y = y * s; this.device = 'pad'; this.mouse.follow = false; this._act(); }
    const b = g.buttons.map(bt => bt.pressed); const edge = (i) => b[i] && !this.padPrev[i];
    if (edge(0)) { this.padT0 = performance.now(); this.events.push({ type: 'confirm' }); }
    if (!b[0] && this.padPrev[0] && this.padT0) { this.events.push({ type: 'dartKey', hold: (performance.now() - this.padT0) / 1000 }); this.padT0 = 0; }
    if (edge(2)) this.events.push({ type: 'budKey' });
    if (edge(4)) this.events.push({ type: 'cycle', dir: -1 }); if (edge(5)) this.events.push({ type: 'cycle', dir: 1 });
    if (edge(9)) this.events.push({ type: 'pause' });
    this.padRally = !!b[1]; this.padSwell = !!b[3]; this.padPrev = b;
  }

  // once per frame: returns the discrete events since last poll
  poll(dt) {
    this._pad();
    const K = this.keys;
    const wasd = !this.keysSplit;
    let kx = (wasd && K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (wasd && K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let ky = (wasd && K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (wasd && K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
    if (kx && ky) { kx *= Math.SQRT1_2; ky *= Math.SQRT1_2; }
    const ramp = Math.min(1, dt * 22);                 // keys ramp fast: analogue feel without sluggishness
    this.keyMove.x += (kx - this.keyMove.x) * ramp; this.keyMove.y += (ky - this.keyMove.y) * ramp;
    if (!kx && Math.abs(this.keyMove.x) < 0.02) this.keyMove.x = 0; if (!ky && Math.abs(this.keyMove.y) < 0.02) this.keyMove.y = 0;
    const nowC = performance.now(); this.charge = Math.max(this.mouse.down ? (nowC - this.mouse.t0) / 1000 : 0, this.keyT0 && !this.keysOff ? (nowC - this.keyT0) / 1000 : 0, this.keyT1 ? (nowC - this.keyT1) / 1000 : 0, this.padT0 ? (nowC - this.padT0) / 1000 : 0);
    this.rally = this.rallyHeld || this.rallyPtr || this.padRally;
    const now = performance.now();
    this.swell2 = [...this.pointers.values()].some(p => p.role === 'second2' && now - p.t0 > 320);
    this.swell = (this.swellKey && !this.keysOff) || this.padSwell || (this.rmb && now - this.rmb > 260) || [...this.pointers.values()].some(p => p.role === 'second' && !p.pinched && now - p.t0 > 320);
    const ev = this.events; this.events = [];
    return this.enabled ? ev : ev.filter(e => e.type === 'pause' || e.type === 'key' || e.type === 'press' || e.type === 'confirm');
  }

  // ── optional tilt (gyro): the pose you switch it on in — or resume in — is "level"; tip the device and the creature runs downhill ──
  get tiltAvailable() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && ((navigator.maxTouchPoints || 0) > 0 || this.tilt.seen); }
  async setTilt(on) {
    const T = this.tilt; if (!on) { T.on = false; T.x = T.y = 0; return false; }
    try { const D = window.DeviceOrientationEvent; if (D && typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return false; } catch (e) { return false; }
    if (!this._tiltBound) { this._tiltBound = true; window.addEventListener('deviceorientation', (e) => this._tilt(e)); }
    T.on = true; T.zero = null; return true;
  }
  levelTilt() { this.tilt.zero = null; this.tilt.x = this.tilt.y = 0; }
  _tilt(e) {
    const T = this.tilt; if (e.beta == null || e.gamma == null) return; T.seen = true; if (!T.on) return;
    const ang = ((typeof screen !== 'undefined' && screen.orientation && screen.orientation.angle) || window.orientation || 0);      // screen-relative axes
    let x = e.gamma, y = e.beta; if (ang === 90) { x = e.beta; y = -e.gamma; } else if (ang === 270 || ang === -90) { x = -e.beta; y = e.gamma; } else if (ang === 180) { x = -e.gamma; y = -e.beta; }
    if (!T.zero) T.zero = { x, y };
    const dx = (x - T.zero.x) / TILT_FULL, dy = (y - T.zero.y) / TILT_FULL, m = Math.hypot(dx, dy);
    if (m < TILT_DEAD) { T.x = T.y = 0; } else { const c = Math.min(1, (m - TILT_DEAD) / (1 - TILT_DEAD)); T.x = dx / m * c; T.y = dy / m * c; this._act(); }
    T.t = performance.now();
  }

  // analogue direction from stick / keys / pad (unit-ish), or null when the pointer should steer instead
  vector() {
    if (!this.enabled) return ZERO;
    if (Math.abs(this.padMove.x) + Math.abs(this.padMove.y) > 0.01) return this.padMove;
    if ((!this.keysOff || this.keysSplit) && Math.abs(this.keyMove.x) + Math.abs(this.keyMove.y) > 0.01) return this.keyMove;
    const S = this.stick;
    if (S.active) {
      let dx = (S.kx - S.ax) / STICK_R, dy = (S.ky - S.ay) / STICK_R; const m = Math.hypot(dx, dy);
      if (m < DEAD) return ZERO;
      const c = Math.min(1, (m - DEAD) / (1 - DEAD)); V.x = dx / m * c; V.y = dy / m * c; return V;
    }
    const T = this.tilt; if (T.on && !this.tiltMute && performance.now() - T.t < 600 && Math.abs(T.x) + Math.abs(T.y) > 0.01) return T;      // (tiltMute: a mode is using the tilt for something else — the Pool pours with it)
    return null;
  }
  // player two's stick, when two share the glass
  vector2() {
    const S = this.stick2; if (!this.enabled || !S.active) return null;
    const dx = (S.kx - S.ax) / STICK_R, dy = (S.ky - S.ay) / STICK_R, m = Math.hypot(dx, dy); if (m < DEAD) return { x: 0, y: 0 };
    const c = Math.min(1, (m - DEAD) / (1 - DEAD)); return { x: dx / m * c, y: dy / m * c };
  }
  get pointerSteers() { return this.enabled && this.device === 'mouse' && this.mouse.follow && this.mouse.inside; }
  get stickRadius() { return STICK_R; }
}
const ZERO = { x: 0, y: 0 }, V = { x: 0, y: 0 };
const DART1 = ['Enter', 'NumpadEnter', 'Slash', 'ShiftRight', 'ControlRight'];
