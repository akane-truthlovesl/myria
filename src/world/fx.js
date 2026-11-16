// ─────────────────────────────────────────────────────────────────────────────
//  FX — short-lived light: sparks, ripples, bubbles, glints.
//  Pure decoration with one rule: every effect answers a cause the player saw.
// ─────────────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
export class FX {
  constructor() { this.list = []; this.max = 420; }
  clear() { this.list.length = 0; }
  add(p) { if (this.list.length >= this.max) this.list.shift(); p.t = 0; p.life = p.life || 0.6; p.vx = p.vx || 0; p.vy = p.vy || 0; p.drag = p.drag ?? 2; p.size = p.size || 3; p.a = p.a ?? 1; p.type = p.type || 0; p.col = p.col || [1, 0.9, 0.8]; this.list.push(p); return p; }
  // type 0 spark · 1 bubble · 2 ring (expanding) · 3 wash (broad soft glow)
  burst(x, y, n, col, speed = 160, o = {}) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = speed * (0.3 + 0.7 * Math.random()); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: (o.life || 0.6) * (0.6 + 0.6 * Math.random()), size: o.size || 3, type: o.type || 0, drag: o.drag ?? 2.5, a: o.a ?? 1 }); } }
  sparks(x, y, n, dx, dy, col, speed = 220, o = {}) { for (let k = 0; k < n; k++) { const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * (o.spread ?? 1.3), s = speed * (0.4 + 0.6 * Math.random()); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: (o.life || 0.5) * (0.6 + 0.6 * Math.random()), size: o.size || 2.4, type: 0, drag: o.drag ?? 3 }); } }
  ring(x, y, col, r = 60, life = 0.6, o = {}) { return this.add({ x, y, col, life, type: 2, size: o.r0 || 4, grow: (r - (o.r0 || 4)) / life, a: o.a ?? 0.8, w: o.w || 2.2, drag: 0 }); }
  wash(x, y, col, r = 80, life = 0.5, a = 0.5) { return this.add({ x, y, col, life, type: 3, size: r, a, drag: 0 }); }
  bubble(x, y, size = 4) { return this.add({ x, y, vx: (Math.random() - 0.5) * 16, vy: -26 - Math.random() * 20, col: [0.9, 0.97, 1], life: 1.3 + Math.random() * 0.6, size, type: 1, drag: 0.5, a: 0.7 }); }
  update(dt) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.t += dt; if (p.t >= p.life) { if (p.onEnd) p.onEnd(p); continue; }
      const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
      L[w++] = p;
    }
    L.length = w;
  }
  draw(ov) {
    for (const p of this.list) {
      const u = p.t / p.life; const fade = p.type === 2 ? (1 - u) * (1 - u) : 1 - u * u;
      if (p.type === 0) ov.glow(p.x, p.y, p.size * (1.6 - 0.6 * u), p.col, p.a * fade);
      else if (p.type === 1) ov.glow(p.x, p.y, p.size * 1.8, p.col, p.a * fade, 2);
      else if (p.type === 2) ov.ring(p.x, p.y, p.size, p.w * (1 - 0.6 * u), p.col, p.a * fade);
      else ov.glow(p.x, p.y, p.size * (0.7 + 0.5 * u), p.col, p.a * (1 - u), 1);
    }
  }
}
