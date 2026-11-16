// Lightweight particle FX — sparks, ripples, glints, intake pulses.
// Rendered additively in world space via the renderer's FX batch.

export class FX {
  constructor() { this.list = []; this.max = 2400; this.shake = 0; this.flash = [0, 0, 0, 0]; }
  add(o) {
    if (this.list.length >= this.max) this.list.shift();
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, t: 0, size: 6, grow: 0, type: 0, r: 1, g: 1, b: 1, a: 1, mask: 0, drag: 2, grav: 0, fade: 1, stretch: 0, top: false, follow: null }, o);
    p.max = p.life;
    this.list.push(p);
    return p;
  }
  burst(x, y, n, col, speed = 200, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.add(Object.assign({ x, y, vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s + (o.vy || 0), life: 0.5 + Math.random() * 0.5, size: 3 + Math.random() * 4, type: 0, r: col[0], g: col[1], b: col[2], a: 1, drag: 3 }, o, { vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s + (o.vy || 0) }));
    }
  }
  sparks(x, y, n, nx, ny, col, speed = 320) {
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6, s = speed * (0.4 + Math.random() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.35, size: 5 + Math.random() * 5, type: 2, stretch: 1, r: col[0], g: col[1], b: col[2], a: 1.4, drag: 4, grav: 500 });
    }
  }
  ring(x, y, col, size = 40, life = 0.6, o = {}) {
    return this.add(Object.assign({ x, y, life, size: size * 0.3, grow: size * 1.6 / life, type: 4, r: col[0], g: col[1], b: col[2], a: 1.1, drag: 0 }, o));
  }
  glint(x, y, col, size = 18, life = 0.5) {
    return this.add({ x, y, life, size, type: 3, r: col[0], g: col[1], b: col[2], a: 1.4, drag: 0 });
  }
  update(dt) {
    const L = this.list;
    let w = 0;
    for (let k = 0; k < L.length; k++) {
      const p = L[k];
      p.t += dt; p.life -= dt;
      if (p.life <= 0) continue;
      if (p.follow) { p.x = p.follow.x + (p.ox || 0); p.y = p.follow.y + (p.oy || 0); }
      else {
        p.vy += p.grav * dt;
        const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      p.size += p.grow * dt;
      L[w++] = p;
    }
    L.length = w;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.flash[3] = Math.max(0, this.flash[3] - dt * 2.5);
  }
  draw(R) {
    for (const p of this.list) {
      const k = Math.min(1, p.life / Math.max(0.001, p.max * 0.5));
      const a = p.a * (p.fade ? k : 1);
      const batch = p.top ? R.fxTop : R.fx;
      if (p.type === 2) {
        // streak: stretch along velocity by pushing a few overlapping dots
        const sp = Math.hypot(p.vx, p.vy); const len = Math.min(28, sp * 0.035) * (p.stretch || 1);
        const ux = sp > 1 ? p.vx / sp : 0, uy = sp > 1 ? p.vy / sp : 0;
        for (let s = 0; s < 3; s++) batch.push(p.x - ux * len * s / 3, p.y - uy * len * s / 3, p.size * (1 - s * 0.22), 0, p.r, p.g, p.b, a * (1 - s * 0.25), p.mask, 0, 0, 0);
      } else batch.push(p.x, p.y, p.size, p.type, p.r, p.g, p.b, a, p.mask, 0, 0, 0);
    }
  }
  clear() { this.list.length = 0; }
}
