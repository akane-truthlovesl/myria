// Critically-damped follow camera with lookahead, size-aware zoom and gentle shake.
export class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; this.tx = 0; this.ty = 0; this.tz = 1; this.vx = 0; this.vy = 0; this.vz = 0; this.bounds = null; this.shake = 0; this.sx = 0; this.sy = 0; this.base = 1; this.lock = null; }
  snap(x, y, z) { this.x = this.tx = x; this.y = this.ty = y; if (z) this.zoom = this.tz = z; this.vx = this.vy = this.vz = 0; }
  update(dt, vw, vh, t) {
    // spring toward targets (ω ≈ 7)
    const w = 6.5, k = w * w, c = 2 * w;
    this.vx += ((this.tx - this.x) * k - this.vx * c) * dt; this.x += this.vx * dt;
    this.vy += ((this.ty - this.y) * k - this.vy * c) * dt; this.y += this.vy * dt;
    const wz = 3.2;
    this.vz += ((this.tz - this.zoom) * wz * wz - this.vz * 2 * wz) * dt; this.zoom += this.vz * dt;
    this.zoom = Math.max(0.12, this.zoom);
    if (this.bounds) {
      const [x0, y0, x1, y1] = this.bounds;
      const hw = vw / this.zoom / 2, hh = vh / this.zoom / 2;
      if (x1 - x0 > hw * 2) this.x = Math.min(x1 - hw, Math.max(x0 + hw, this.x)); else this.x = (x0 + x1) / 2;
      if (y1 - y0 > hh * 2) this.y = Math.min(y1 - hh, Math.max(y0 + hh, this.y)); else this.y = (y0 + y1) / 2;
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 14;
    this.sx = s * (Math.sin(t * 53.1) + Math.sin(t * 31.7) * 0.5);
    this.sy = s * (Math.cos(t * 47.3) + Math.sin(t * 27.9) * 0.5);
  }
  view() { return { x: this.x + this.sx / this.zoom, y: this.y + this.sy / this.zoom, zoom: this.zoom }; }
}
