// ─────────────────────────────────────────────────────────────────────────────
//  Duet input — two wills on one device.
//  Keys: P1 = WASD · Space dart · E bud · Q rally · Tab swap
//        P2 = Arrows · Enter / RightShift dart · / or . bud · RightCtrl or ' rally · \ swap
//  Touch / mouse: left half drives P1, right half drives P2 (floating sticks,
//  whip-flick to dart, extra-finger tap to bud). Two pads: one each (one pad → P2).
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], dart: ['Space'], bud: ['KeyE'], rally: ['KeyQ'], cycle: ['Tab'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], dart: ['Enter', 'NumpadEnter', 'ShiftRight', 'Numpad0'], bud: ['Slash', 'Period', 'NumpadDecimal'], rally: ['ControlRight', 'Quote', 'Numpad1'], cycle: ['Backslash', 'NumpadAdd'] },
];
const STICK_R = 64, DEAD = 0.08;

function anyDown(K, codes) { for (const c of codes) if (K.has(c)) return true; return false; }

export class DuetInput {
  constructor(G) {
    this.G = G;
    this.pl = [0, 1].map(() => ({ move: { x: 0, y: 0 }, km: { x: 0, y: 0 }, pm: { x: 0, y: 0 }, act: [], rally: false, stick: null, facing: { x: 1, y: 0 }, device: 'keys' }));
    this.tracked = new Map();
    this.padPrev = [[], []];
  }

  key(code) {
    for (let k = 0; k < 2; k++) {
      const m = KEYS[k], P = this.pl[k];
      if (m.dart.includes(code)) { P.act.push({ type: 'dart' }); P.device = 'keys'; }
      if (m.bud.includes(code)) { P.act.push({ type: 'bud' }); P.device = 'keys'; }
      if (m.cycle.includes(code)) P.act.push({ type: 'cycle' });
    }
  }

  flick(T) {
    const p = T.ref; const h = p.hist || [];
    if (h.length < 2) return null;
    const tEnd = h[h.length - 1][2];
    if (performance.now() - tEnd > 140) return null;          // finger had stopped before lifting
    let k = h.length - 1; while (k > 0 && tEnd - h[k][2] < 85) k--;
    const [x0, y0, t0] = h[k];
    const dt = Math.max(16, tEnd - t0);
    const vx = (p.x - x0) / dt, vy = (p.y - y0) / dt, sp = Math.hypot(vx, vy);
    const th = p.touch ? 0.95 : 1.25;
    if (sp > th && Math.hypot(p.x - x0, p.y - y0) > 24) return { x: vx / sp, y: vy / sp, power: Math.min(1.6, sp / th) };
    return null;
  }

  poll(dt) {
    const G = this.G, K = G.input.keys;
    // ── keys (ramped for an analogue feel) ──────────────────────────────
    for (let k = 0; k < 2; k++) {
      const m = KEYS[k], P = this.pl[k];
      let x = (anyDown(K, m.right) ? 1 : 0) - (anyDown(K, m.left) ? 1 : 0);
      let y = (anyDown(K, m.down) ? 1 : 0) - (anyDown(K, m.up) ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      P.km.x += (x - P.km.x) * 0.35; P.km.y += (y - P.km.y) * 0.35;
      if (!x && Math.abs(P.km.x) < 0.02) P.km.x = 0;
      if (!y && Math.abs(P.km.y) < 0.02) P.km.y = 0;
      P.rally = anyDown(K, m.rally);
      if (x || y) P.device = 'keys';
    }
    // ── pointers: left half → P1, right half → P2 ───────────────────────
    const W = G.canvas.clientWidth;
    const seen = new Set();
    for (const p of G.input.pointers.values()) {
      if (p.role === 'bud' || p.role === 'rally') continue;     // right / middle mouse buttons
      seen.add(p.id);
      let T = this.tracked.get(p.id);
      if (!T) {
        T = { id: p.id, side: p.x0 < W / 2 ? 0 : 1, ax: p.x0, ay: p.y0, ref: p, t0: performance.now(), role: 'extra' };
        const P = this.pl[T.side];
        if (!P.stick) { P.stick = T; T.role = 'stick'; }
        this.tracked.set(p.id, T);
        P.device = p.touch ? 'touch' : 'mouse';
      }
      T.ref = p;
      if (T.role === 'stick') {
        const dx = p.x - T.ax, dy = p.y - T.ay, d = Math.hypot(dx, dy), R = STICK_R * 1.15;
        if (d > R) { T.ax = p.x - dx / d * R; T.ay = p.y - dy / d * R; }
      }
    }
    for (const [id, T] of this.tracked) {
      if (seen.has(id)) continue;
      const P = this.pl[T.side];
      if (T.role === 'stick') {
        P.stick = null;
        const f = this.flick(T);
        if (f) P.act.push({ type: 'dart', x: f.x, y: f.y, power: f.power });
      } else {
        const dur = performance.now() - T.t0, moved = Math.hypot(T.ref.x - T.ref.x0, T.ref.y - T.ref.y0);
        if (dur < 300 && moved < 24) P.act.push({ type: 'bud', sx: T.ref.x, sy: T.ref.y });
      }
      this.tracked.delete(id);
    }
    // ── gamepads ─────────────────────────────────────────────────────────
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected) : [];
    const assign = pads.length >= 2 ? [pads[0], pads[1]] : pads.length === 1 ? [null, pads[0]] : [null, null];
    for (let k = 0; k < 2; k++) {
      const g = assign[k], P = this.pl[k];
      P.pm.x = 0; P.pm.y = 0;
      if (!g) continue;
      let x = g.axes[0] || 0, y = g.axes[1] || 0;
      if (g.buttons[14]?.pressed) x = -1; if (g.buttons[15]?.pressed) x = 1;
      if (g.buttons[12]?.pressed) y = -1; if (g.buttons[13]?.pressed) y = 1;
      const m = Math.hypot(x, y);
      if (m > 0.15) { const s = Math.min(1, (m - 0.15) / 0.8) / m; P.pm.x = x * s; P.pm.y = y * s; P.device = 'pad'; }
      const b = g.buttons.map(bt => bt.pressed), prev = this.padPrev[k];
      const edge = (i) => b[i] && !prev[i];
      if (edge(0)) P.act.push({ type: 'dart' });
      if (edge(2)) P.act.push({ type: 'bud' });
      if (edge(5) || edge(4)) P.act.push({ type: 'cycle' });
      if (b[1]) P.rally = true;
      if (edge(9)) P.act.push({ type: 'pause' });
      this.padPrev[k] = b;
    }
    // ── resolve: stick > pad > keys ──────────────────────────────────────
    for (let k = 0; k < 2; k++) {
      const P = this.pl[k];
      let mx = 0, my = 0;
      if (P.stick) {
        const T = P.stick, p = T.ref;
        let dx = (p.x - T.ax) / STICK_R, dy = (p.y - T.ay) / STICK_R;
        const m = Math.hypot(dx, dy);
        if (m < DEAD) { dx = 0; dy = 0; } else { const c = Math.min(1, (m - DEAD) / (1 - DEAD)); dx = dx / m * c; dy = dy / m * c; }
        mx = dx; my = dy;
      } else if (Math.abs(P.pm.x) + Math.abs(P.pm.y) > 0.01) { mx = P.pm.x; my = P.pm.y; }
      else { mx = P.km.x; my = P.km.y; }
      P.move.x = mx; P.move.y = my;
      const mm = Math.hypot(mx, my);
      if (mm > 0.2) { P.facing.x = mx / mm; P.facing.y = my / mm; }
    }
  }

  take(k) { const a = this.pl[k].act; this.pl[k].act = []; return a; }
  clear() { for (const P of this.pl) { P.act = []; } }
  get stickRadius() { return STICK_R; }
}
