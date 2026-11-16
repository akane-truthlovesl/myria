// ─────────────────────────────────────────────────────────────────────────────
//  MYRIA soft-matter engine
//  Viscoelastic particle continuum (double-density relaxation + plastic springs)
//  • Surface tension never switches off: a 2-particle droplet is still a pearl.
//  • Every constant is per-material and modulated per body / zone / temperature.
//  • One continuum for one organism or a hundred droplets: bodies are labels on
//    particles; split = connectivity loss, fuse = cohesive contact.
// ─────────────────────────────────────────────────────────────────────────────
import { M, SURF_FRIC, SURF_ADH, SURF_CLING, SURF_REST, SURF, PHASE } from './materials.js';

export const H = 16;               // interaction radius (world units)
export const SPACING = 7.0;        // nominal rest spacing (for spawning)
export const PR = 4.0;             // particle wall radius
export const AREA_PER_P = SPACING * SPACING * 0.95;
const ADH_RANGE = 6.0;
const SPR = 6;                     // springs stored per particle
const DT_REF = 1 / 120;

export class Body {
  constructor(id) {
    this.id = id; this.reset();
  }
  reset() {
    this.alive = false;
    this.group = -1;        // colony id (-1 = neutral/dew)
    this.kind = 'loose';
    this.mat = 0;
    this.count = 0; this.cx = 0; this.cy = 0; this.vx = 0; this.vy = 0; this.r = 0;
    this.minx = 0; this.miny = 0; this.maxx = 0; this.maxy = 0;
    this.fuseT = 0;         // fusion cooldown (fresh-cut passivation)
    this.contact = 0; this.cnx = 0; this.cny = 0; this.clingContact = 0;
    // drive (written by controllers, consumed every substep)
    this.ax = 0; this.ay = 0; this.lx = 0; this.ly = 0; this.lead = 0;
    this.tonus = 0; this.tonusReach = 1.15;
    this.waveA = 0; this.waveW = 2.0; this.wavePh = Math.random() * 6.28;
    this.gs = 1; this.adhMul = 1; this.fricMul = 1; this.damp = 0; this.stiff = 1; this.visc = 1;
    this.leadNorm = 1;
    this.start = 0; this.len = 0;    // slice into physics.bodyIdx
    this.ctrl = null; this.tag = null;
    this.age = 0; this.spin = 0; this.energy = 0;
    this.tension = 0; this.stretch = 0; this.inflate = 0;      // 0..1: an air cavity held open inside the gel
    this.hot = 0;
    this.tint = null;
  }
}

export class Physics {
  constructor(maxp = 6144, maxb = 768) {
    this.maxp = maxp; this.maxb = maxb;
    const F = n => new Float32Array(n);
    this.x = F(maxp); this.y = F(maxp); this.vx = F(maxp); this.vy = F(maxp);
    this.ox = F(maxp); this.oy = F(maxp);
    this.fx = F(maxp); this.fy = F(maxp);
    this.rho = F(maxp); this.rhoN = F(maxp); this.P = F(maxp); this.PN = F(maxp);
    this.nx = F(maxp); this.ny = F(maxp); this.surf = F(maxp);
    this.temp = F(maxp); this.glow = F(maxp); this.life = F(maxp); this.rr = F(maxp);
    this.cutT = F(maxp); this.cutS = new Int8Array(maxp); this.cutB = new Int16Array(maxp).fill(-1);
    this.cnx = F(maxp); this.cny = F(maxp); this.contact = new Uint8Array(maxp);
    this.xsx = F(maxp); this.xsy = F(maxp); this.xsw = F(maxp);
    this.mat = new Uint8Array(maxp);
    this.body = new Int16Array(maxp).fill(-1);
    this.alive = new Uint8Array(maxp);
    this.gen = new Uint16Array(maxp);
    this.hue = F(maxp);
    this.mix = F(maxp);            // 0..1 pigment coordinate (foreign colour swirled into a body)
    this.psz = F(maxp).fill(1);      // polydispersity: frustrates crystallisation → amorphous, round gel
    this.hi = 0; this.count = 0;
    this.free = new Int32Array(maxp); this.nfree = 0;
    // springs (stored at the lower index of the pair)
    this.sj = new Int32Array(maxp * SPR).fill(-1);
    this.sl = new Float32Array(maxp * SPR);
    this.sg = new Uint16Array(maxp * SPR);
    // pairs
    this.pcap = maxp * 20;
    this.pi = new Int32Array(this.pcap); this.pj = new Int32Array(this.pcap);
    this.pc = new Uint8Array(this.pcap);
    this.pr = new Float32Array(this.pcap);   // cached pair distance
    this.pux = new Float32Array(this.pcap); this.puy = new Float32Array(this.pcap);  // cached unit vector i→j
    this.pa = new Float32Array(this.pcap);   // cached 1 - r/H (post-relax geometry)
    this.dxa = new Float32Array(maxp); this.dya = new Float32Array(maxp);
    this.np = 0;
    // bodies
    this.bodies = []; for (let b = 0; b < maxb; b++) this.bodies.push(new Body(b));
    this.bodyIdx = new Int32Array(maxp);
    this.bcount = new Int32Array(maxb);
    // world
    this.gx = 0; this.gy = 0; this.drag = 0;
    this.sdf = null;
    this.shapes = [];
    this.zones = [];
    this.setBounds(-1000, -1000, 1000, 1000);
    this.events = { merges: [], contacts: [], cuts: 0, impacts: [], grind: [], bounce: [] };
    this.time = 0;
    this._sprTick = 0;
    this.poly = 0.04;
    this.compCounter = 0;
    this.forceComponents = false;
    this.uf = new Int32Array(maxp);
    this.onSplit = null; this.onMerge = null;
    this.ncontacts = 0;
    this.contactA = new Int32Array(4096); this.contactB = new Int32Array(4096);
  }

  setBounds(x0, y0, x1, y1) {
    this.bx0 = x0; this.by0 = y0; this.bx1 = x1; this.by1 = y1;
    this.cell = H;
    this.gw = Math.max(1, Math.ceil((x1 - x0) / H) + 2);
    this.gh = Math.max(1, Math.ceil((y1 - y0) / H) + 2);
    const nc = this.gw * this.gh;
    this.cellStart = new Int32Array(nc + 1);
    this.cellCnt = new Int32Array(nc + 1);
    this.pcell = new Int32Array(this.maxp);
    this.sorted = new Int32Array(this.maxp);
  }

  // ── particle lifecycle ────────────────────────────────────────────────────
  spawn(x, y, vx, vy, mat, body) {
    let i;
    if (this.nfree > 0) i = this.free[--this.nfree];
    else if (this.hi < this.maxp) i = this.hi++;
    else return -1;
    this.x[i] = x; this.y[i] = y; this.ox[i] = x - vx * DT_REF; this.oy[i] = y - vy * DT_REF;
    this.vx[i] = vx; this.vy[i] = vy; this.fx[i] = 0; this.fy[i] = 0;
    this.mat[i] = mat; this.body[i] = body; this.alive[i] = 1;
    this.gen[i] = (this.gen[i] + 1) & 0xffff;
    this.temp[i] = 0; this.glow[i] = 0.6; this.life[i] = 0; this.rr[i] = 0.35;
    this.cutT[i] = 0; this.cutB[i] = -1; this.contact[i] = 0;
    this.hue[i] = Math.random(); this.mix[i] = 0;
    this.psz[i] = this.poly ? (Math.random() < 0.5 ? 1 - this.poly : 1 + this.poly) * (0.97 + Math.random() * 0.06) : 1;
    const s = i * SPR; for (let k = 0; k < SPR; k++) this.sj[s + k] = -1;
    this.count++;
    return i;
  }
  kill(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0; this.body[i] = -1; this.count--;
    this.free[this.nfree++] = i;
  }
  allocBody(group = -1, kind = 'loose', mat = 0) {
    for (let b = 0; b < this.maxb; b++) {
      const B = this.bodies[b];
      if (!B.alive && this.bcount[b] === 0 && !B._pending) {
        B.reset(); B.serial = (this._serial = (this._serial || 0) + 1); B.alive = true; B.group = group; B.kind = kind; B.mat = mat; B._pending = true;
        return B;
      }
    }
    return null;
  }
  freeBody(B) { B.alive = false; B.ctrl = null; B._pending = false; }

  // ── fusion rules: contextual, never absolute ─────────────────────────────
  cohesive(bi, bj, mi, mj) {
    if (bi === bj) return true;
    if (M.phase[mi] !== M.phase[mj]) return false;
    const A = this.bodies[bi], B = this.bodies[bj];
    if (A.fuseT > 0 || B.fuseT > 0) return false;
    if (A.group === B.group) return A.group !== -2; // -2: never-fuse singletons
    if (A.group === -1 || B.group === -1) return true; // neutral dew joins anything
    return false;
  }

  // ── main integrator ──────────────────────────────────────────────────────
  step(frameDt) {
    // never more than 3 substeps: below ~40 fps time dilates gracefully instead of death-spiralling
    const fd = Math.min(Math.max(frameDt, 1 / 240), 3 * DT_REF);
    const n = Math.max(1, Math.ceil(fd / DT_REF - 0.05));
    const dt = fd / n;
    this.events.merges.length = 0; this.events.impacts.length = 0; this.events.grind.length = 0; this.events.bounce.length = 0;
    this.events.cuts = 0; this.ncontacts = 0;
    for (let s = 0; s < n; s++) this.substep(dt, s === n - 1);
    this.time += fd;
    // fuse cooldowns
    for (const B of this.bodies) if (B.alive && B.fuseT > 0) B.fuseT -= fd;
    this.aggregate(fd);
    this.compCounter++;
    if (this.forceComponents || this.compCounter % 5 === 0) { this.components(); this.forceComponents = false; }
    this.processMerges();
  }

  substep(dt, last) {
    const sc = (dt / DT_REF) * (dt / DT_REF);
    this.applyForces(dt);
    this.buildGrid();
    this.buildPairs();
    this.viscosity(dt);
    // predict
    const { x, y, vx, vy, ox, oy, alive, hi } = this;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      ox[i] = x[i]; oy[i] = y[i];
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    }
    this.springs(dt, sc);
    this.relax(sc, last);
    this.collide(dt);
    // velocities
    const maxv = 0.85 * H / dt;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      let ux = (x[i] - ox[i]) / dt, uy = (y[i] - oy[i]) / dt;
      const sp = ux * ux + uy * uy;
      if (sp > maxv * maxv) { const f = maxv / Math.sqrt(sp); ux *= f; uy *= f; x[i] = ox[i] + ux * dt; y[i] = oy[i] + uy * dt; }
      vx[i] = ux; vy[i] = uy;
    }
    this.xsph(dt);
    // timers
    const life = this.life, rr = this.rr, cutT = this.cutT, glow = this.glow;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      if (rr[i] < 1) rr[i] = Math.min(1, rr[i] + dt * 3.5);
      if (cutT[i] > 0) { cutT[i] -= dt; if (cutT[i] <= 0) this.cutB[i] = -1; }
      if (glow[i] > 0) glow[i] = Math.max(0, glow[i] - dt * 0.9);
      if (life[i] > 0) {
        life[i] -= dt;
        if (life[i] < 0.6) rr[i] = Math.min(rr[i], Math.max(0.05, life[i] / 0.6));
        if (life[i] <= 0) this.kill(i);
      }
    }
  }

  applyForces(dt) {
    const { x, y, vx, vy, fx, fy, alive, hi, mat, body, bodies } = this;
    const zones = this.zones, nz = zones.length;
    const gx0 = this.gx, gy0 = this.gy;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      const m = mat[i];
      const B = bodies[body[i]];
      let gs = M.grav[m] * B.gs;
      let gx = gx0, gy = gy0;
      let ax = fx[i], ay = fy[i];
      let drag = this.drag + M.drag[m];
      const px = x[i], py = y[i];
      for (let z = 0; z < nz; z++) {
        const Z = zones[z];
        if (px < Z.x0 || px > Z.x1 || py < Z.y0 || py > Z.y1) continue;
        const w = Z.weight ? Z.weight(px, py) : 1;
        if (w <= 0) continue;
        if (Z.gravity) { gx += (Z.gx - gx) * w; gy += (Z.gy - gy) * w; }
        if (Z.flow) {
          const k = Z.flowK * w;
          let fvx = Z.fvx, fvy = Z.fvy;
          if (Z.flowAt) { const f = Z.flowAt(px, py); fvx = f[0]; fvy = f[1]; }
          ax += (fvx - vx[i]) * k; ay += (fvy - vy[i]) * k;
        }
        if (Z.attract) {
          // gravity well: a = S / (r + soft) — long reach, finite at the core
          const dx = Z.ax - px, dy = Z.ay - py; const r = Math.sqrt(dx * dx + dy * dy) + 1e-3;
          const f = Z.strength * w / (r + (Z.soft || 60));
          ax += dx / r * f; ay += dy / r * f;
          if (Z.swirl) { const fs = Z.swirl * w / (r + (Z.soft || 60)); ax += -dy / r * fs; ay += dx / r * fs; }
        }
        if (Z.magnet && M.magnet[m] > 0) {
          const dx = Z.ax - px, dy = Z.ay - py; const r2 = dx * dx + dy * dy + 900; const r = Math.sqrt(r2);
          let f = Z.magnet * M.magnet[m] * w * 2.4e6 / (r2 * r); if (f > 2300) f = 2300;
          ax += dx / r * f; ay += dy / r * f;
          // Rosensweig spikes: the surface erupts into a crown of crisp cones
          if (this.surf[i] > 0.3) {
            const th = Math.atan2(py - B.cy, px - B.cx);
            const c = Math.cos(th * 9 + this.time * 0.6);
            const spike = c > 0 ? c * c * c * c * c * c : 0;
            const field = Math.min(1, Z.magnet * w * 220000 / (r2 + 4e4));
            const a = 2600 * spike * field * this.surf[i];
            ax += this.nx[i] * a; ay += this.ny[i] * a;
          }
        }
        if (Z.heat) this.temp[i] += (Z.heat - this.temp[i]) * Math.min(1, dt * Z.heatRate * w);
        if (Z.drag) drag += Z.drag * w;
        if (Z.buoy) gs *= (1 - Z.buoy * w);
      }
      // tonus: saturating self-attraction — living muscle tone that keeps a bead
      if (B.tonus > 0 && B.count > 1) {
        const dx = B.cx - px, dy = B.cy - py; const d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        const lim = B.r * B.tonusReach;
        const f = B.tonus * (d < lim ? d : lim) / d;
        ax += dx * f; ay += dy * f;
      }
      // swell: a held breath pushes the gel off its own centre — a hollow dome, twice the silhouette, the same mass
      if (B.inflate > 0.03 && B.count > 5) {
        const dx = px - B.cx, dy = py - B.cy; const d = Math.sqrt(dx * dx + dy * dy) + 0.5; const lim = B.r * (0.75 + 0.75 * B.inflate);
        if (d < lim) { const f = 900 * B.inflate * (1 - d / lim) / d; ax += dx * f; ay += dy * f; }
      }
      // breathing: area-conserving surface modes (k ≥ 2) — alive, never static noise
      if (B.waveA > 0 && this.surf[i] > 0.15) {
        const dx = px - B.cx, dy = py - B.cy;
        const th = Math.atan2(dy, dx);
        const t = this.time;
        const wv = Math.cos(2 * th - B.waveW * t + B.wavePh) * 0.65 + Math.cos(3 * th + B.waveW * 0.77 * t + B.wavePh * 1.7) * 0.35;
        const a = B.waveA * wv * this.surf[i];
        ax += this.nx[i] * a; ay += this.ny[i] * a;
      }
      // body drive (locomotion) with pseudopod lead weighting
      if (B.ax !== 0 || B.ay !== 0) {
        let w = 1;
        if (B.lead > 0 && B.r > 0) {
          const s = ((px - B.cx) * B.lx + (py - B.cy) * B.ly) / (B.r + 4);
          const t = s < 0.1 ? 0 : s > 1 ? 1 : (s - 0.1) / 0.9;
          w = (1 + B.lead * t * t * (3 - 2 * t)) * B.leadNorm;
        }
        ax += B.ax * w; ay += B.ay * w;
      }
      vx[i] += (gx * gs + ax) * dt;
      vy[i] += (gy * gs + ay) * dt;
      if (drag > 0) { const f = Math.max(0, 1 - drag * dt); vx[i] *= f; vy[i] *= f; }
      if (B.damp > 0) {
        const f = Math.max(0, 1 - B.damp * dt);
        vx[i] = B.vx + (vx[i] - B.vx) * f; vy[i] = B.vy + (vy[i] - B.vy) * f;
      }
      fx[i] = 0; fy[i] = 0;
    }
  }

  buildGrid() {
    const { x, y, alive, hi, gw, gh, bx0, by0 } = this;
    const inv = 1 / this.cell;
    const cnt = this.cellCnt, start = this.cellStart, pcell = this.pcell, sorted = this.sorted;
    const nc = gw * gh;
    cnt.fill(0);
    let n = 0;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      let cx = ((x[i] - bx0) * inv) | 0, cy = ((y[i] - by0) * inv) | 0;
      if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
      if (cy < 0) cy = 0; else if (cy >= gh) cy = gh - 1;
      const c = cy * gw + cx; pcell[i] = c; cnt[c]++; n++;
    }
    let s = 0;
    for (let c = 0; c < nc; c++) { start[c] = s; s += cnt[c]; cnt[c] = start[c]; }
    start[nc] = s;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      sorted[cnt[pcell[i]]++] = i;
    }
    this.nsorted = n;
  }

  buildPairs() {
    const { x, y, sorted, cellStart, gw, gh, body, mat, pcell } = this;
    const pi = this.pi, pj = this.pj, pc = this.pc, cap = this.pcap, pr = this.pr, pux = this.pux, puy = this.puy;
    const R2 = (H * 1.04) * (H * 1.04);
    const ns = this.nsorted;
    // positions in cell-sorted order → cache-friendly inner loops
    const sx = this._sx || (this._sx = new Float32Array(this.maxp)), sy = this._sy || (this._sy = new Float32Array(this.maxp));
    for (let k = 0; k < ns; k++) { const i = sorted[k]; sx[k] = x[i]; sy[k] = y[i]; }
    const PH = M.phase;
    let np = 0;
    let a = 0;
    while (a < ns && np < cap) {
      const c = pcell[sorted[a]];
      const s0 = a, s1 = cellStart[c + 1];
      const cx = c % gw, cy = (c / gw) | 0;
      // within the cell
      for (let u = s0; u < s1; u++) {
        const ux = sx[u], uy = sy[u];
        for (let v = u + 1; v < s1; v++) { const dx = sx[v] - ux, dy = sy[v] - uy; const d2 = dx * dx + dy * dy; if (d2 < R2 && np < cap) { const i = sorted[u], j = sorted[v]; pi[np] = i; pj[np] = j; const bi = body[i], bj = body[j], mi = mat[i], mj = mat[j];
            pc[np] = bi === bj ? (PH[mi] === PH[mj] ? 1 : 0) : (this.cohesive(bi, bj, mi, mj) ? 1 : 0);
            const r = Math.sqrt(d2) + 1e-6; pr[np] = r; pux[np] = dx / r; puy[np] = dy / r; np++; } }
      }
      // forward neighbour cells
      for (let k = 0; k < 4; k++) {
        let nx = cx, ny = cy;
        if (k === 0) { nx = cx + 1; ny = cy - 1; } else if (k === 1) { nx = cx + 1; } else if (k === 2) { nx = cx + 1; ny = cy + 1; } else { ny = cy + 1; }
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const cc = ny * gw + nx;
        const t0 = cellStart[cc], t1 = cellStart[cc + 1];
        if (t0 === t1) continue;
        for (let u = s0; u < s1; u++) {
          const ux = sx[u], uy = sy[u];
          for (let v = t0; v < t1; v++) { const dx = sx[v] - ux, dy = sy[v] - uy; const d2 = dx * dx + dy * dy; if (d2 < R2 && np < cap) { const i = sorted[u], j = sorted[v]; pi[np] = i; pj[np] = j; const bi = body[i], bj = body[j], mi = mat[i], mj = mat[j];
            pc[np] = bi === bj ? (PH[mi] === PH[mj] ? 1 : 0) : (this.cohesive(bi, bj, mi, mj) ? 1 : 0);
            const r = Math.sqrt(d2) + 1e-6; pr[np] = r; pux[np] = dx / r; puy[np] = dy / r; np++; } }
        }
      }
      a = s1;
    }
    this.np = np;
  }

  viscosity(dt) {
    const { vx, vy, pi, pj, pc, np, mat, body, bodies, pr, pux, puy } = this;
    const f60 = dt * 60;
    const SIG = M.sigma, BET = M.beta, THK = M.thick;
    for (let p = 0; p < np; p++) {
      if (!pc[p]) continue;
      const q = pr[p] / H; if (q >= 1) continue;
      const i = pi[p], j = pj[p];
      const ux = pux[p], uy = puy[p];
      const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
      if (u <= 0) continue;
      const mi = mat[i], mj = mat[j];
      let sig = (SIG[mi] + SIG[mj]) * 0.5;
      const th = (THK[mi] + THK[mj]) * 0.5;
      if (th > 0 && u > 90) sig *= 1 + th * Math.min(6, (u - 90) / 90);
      sig *= bodies[body[i]].visc;
      const bet = (BET[mi] + BET[mj]) * 0.5;
      let I = (1 - q) * (sig * u + bet * u * u * 0.01) * f60;
      if (I > u * 0.5) I = u * 0.5;
      const ix = I * ux * 0.5, iy = I * uy * 0.5;
      vx[i] -= ix; vy[i] -= iy; vx[j] += ix; vy[j] += iy;
    }
  }

  springs(dt, sc) {
    const { x, y, pi, pj, pc, np, mat, body, sj, sl, sg, gen, alive, hi, bodies, pr } = this;
    // create (every other substep is plenty)
    const CR = H * 0.62;
    this._sprTick = (this._sprTick + 1) | 0;
    if (this._sprTick & 1) for (let p = 0; p < np; p++) {
      if (!pc[p] || pr[p] > CR) continue;
      let i = pi[p], j = pj[p];
      if (body[i] !== body[j]) continue;
      if (!M.spring[mat[i]] || !M.spring[mat[j]]) continue;
      const r2 = pr[p] * pr[p];
      if (i > j) { const t = i; i = j; j = t; }
      const s = i * SPR;
      let found = false, freeK = -1;
      for (let k = 0; k < SPR; k++) {
        const pjk = sj[s + k];
        if (pjk === j && sg[s + k] === gen[j]) { found = true; break; }
        if (pjk < 0 && freeK < 0) freeK = k;
      }
      if (!found && freeK >= 0) { sj[s + freeK] = j; sl[s + freeK] = Math.sqrt(r2); sg[s + freeK] = gen[j]; }
    }
    // relax
    const cutB = this.cutB, cutS = this.cutS;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      const s = i * SPR;
      const mi = mat[i];
      const B = bodies[body[i]];
      const k0 = M.sk[mi] * sc * B.stiff, yr = M.yieldR[mi], pl = M.plast[mi] * dt, creep = M.creep[mi] * dt;
      for (let k = 0; k < SPR; k++) {
        const j = sj[s + k];
        if (j < 0) continue;
        if (!alive[j] || sg[s + k] !== gen[j] || body[j] !== body[i]) { sj[s + k] = -1; continue; }
        if (cutB[i] >= 0 && cutB[i] === cutB[j] && cutS[i] !== cutS[j]) { sj[s + k] = -1; continue; }
        const dx = x[j] - x[i], dy = y[j] - y[i];
        const r = Math.sqrt(dx * dx + dy * dy);
        let L = sl[s + k];
        const d = yr * L;
        if (r > L + d) L += pl * (r - L - d);
        else if (r < L - d) L -= pl * (L - d - r);
        L += (r - L) * creep;      // viscoelastic creep: memory fades, the pearl returns
        if (L > H * 1.05 || r > H * 1.6) { sj[s + k] = -1; continue; }
        sl[s + k] = L;
        if (r < 1e-5) continue;
        const D = k0 * (1 - L / (H * 1.1)) * (L - r) * 0.5;
        const ux = dx / r * D, uy = dy / r * D;
        x[i] -= ux; y[i] -= uy; x[j] += ux; y[j] += uy;
      }
    }
  }

  relax(sc, last) {
    const { x, y, pi, pj, pc, np, mat, rho, rhoN, P, PN, alive, hi, body, bodies, psz, pa, pux, puy, dxa, dya } = this;
    for (let i = 0; i < hi; i++) { rho[i] = 0; rhoN[i] = 0; dxa[i] = 0; dya[i] = 0; }
    const cutB = this.cutB, cutS = this.cutS;
    // geometry once per substep (post-spring positions), cached for density, displacement, normals, XSPH
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r2 = dx * dx + dy * dy;
      if (r2 >= H * H || r2 < 1e-10) { pa[p] = 0; continue; }
      const r = Math.sqrt(r2);
      const a = 1 - r / H;
      pa[p] = a; pux[p] = dx / r; puy[p] = dy / r;
      const a2 = a * a, a3 = a2 * a;
      let coh = pc[p];
      if (coh && cutB[i] >= 0 && cutB[i] === cutB[j] && cutS[i] !== cutS[j]) { coh = 0; pc[p] = 0; }
      if (coh) { rho[i] += a2; rho[j] += a2; rhoN[i] += a3; rhoN[j] += a3; }
      else { rhoN[i] += a3 * 1.6; rhoN[j] += a3 * 1.6; }
    }
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      const m = mat[i];
      const B = bodies[body[i]];
      const k = M.k[m] * sc * B.stiff;
      const r0 = M.rho0[m] / (psz[i] * psz[i]) * (1 - 0.42 * B.inflate);
      let p = k * (rho[i] - r0);
      // limit cohesion pull so isolated strands never implode violently
      const pmin = -k * r0 * 0.7;
      if (p < pmin) p = pmin;
      P[i] = p; PN[i] = M.kn[m] * sc * rhoN[i];
    }
    const HH = H * 0.5;
    for (let p = 0; p < np; p++) {
      const a = pa[p]; if (a <= 0) continue;
      const i = pi[p], j = pj[p];
      let D;
      if (pc[p]) D = ((P[i] + P[j]) * a + (PN[i] + PN[j]) * a * a) * HH;
      else D = (PN[i] + PN[j]) * a * a * HH * 1.25;
      if (D > H * 0.25) D = H * 0.25; else if (D < -H * 0.12) D = -H * 0.12;
      const ux = pux[p] * D * 0.5, uy = puy[p] * D * 0.5;
      dxa[i] -= ux; dya[i] -= uy; dxa[j] += ux; dya[j] += uy;
    }
    for (let i = 0; i < hi; i++) { if (alive[i]) { x[i] += dxa[i]; y[i] += dya[i]; } }
    if (last) {
      // surface normals (colour-field gradient) for optics, breathing, feelers
      const { nx, ny, surf } = this;
      for (let i = 0; i < hi; i++) { nx[i] = 0; ny[i] = 0; }
      for (let p = 0; p < np; p++) {
        const a = pa[p]; if (a <= 0 || !pc[p]) continue;
        const i = pi[p], j = pj[p];
        const wx = pux[p] * a, wy = puy[p] * a;
        nx[i] -= wx; ny[i] -= wy; nx[j] += wx; ny[j] += wy;
      }
      for (let i = 0; i < hi; i++) {
        if (!alive[i]) continue;
        const l = Math.sqrt(nx[i] * nx[i] + ny[i] * ny[i]);
        const s = Math.min(1, Math.max(0, (l - 0.25) / 0.9));
        surf[i] = s;
        if (l > 1e-5) { nx[i] /= l; ny[i] /= l; }
      }
    }
  }

  collide(dt) {
    const { x, y, ox, oy, alive, hi, mat, body, bodies, contact, cnx, cny } = this;
    const sdf = this.sdf;
    for (let i = 0; i < hi; i++) contact[i] = 0;
    if (sdf) {
      const data = sdf.data, sw = sdf.w, sh = sdf.h, res = sdf.res, inv = 1 / res, sx0 = sdf.x0, sy0 = sdf.y0, smat = sdf.mat;
      const lim = PR + ADH_RANGE;
      for (let i = 0; i < hi; i++) {
        if (!alive[i]) continue;
        let fx = (x[i] - sx0) * inv, fy = (y[i] - sy0) * inv;
        if (fx < 0) fx = 0; else if (fx > sw - 1.001) fx = sw - 1.001;
        if (fy < 0) fy = 0; else if (fy > sh - 1.001) fy = sh - 1.001;
        const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
        const k0 = iy * sw + ix;
        const d00 = data[k0], d10 = data[k0 + 1], d01 = data[k0 + sw], d11 = data[k0 + sw + 1];
        const d = (d00 + (d10 - d00) * tx) * (1 - ty) + (d01 + (d11 - d01) * tx) * ty;
        if (d >= lim) continue;
        // smooth gradient via bilinear partials
        let gx = ((d10 - d00) * (1 - ty) + (d11 - d01) * ty);
        let gy = ((d01 - d00) * (1 - tx) + (d11 - d10) * tx);
        let gl = Math.sqrt(gx * gx + gy * gy);
        if (gl < 1e-6) { gx = 0; gy = -1; gl = 1; }
        const nxw = gx / gl, nyw = gy / gl;
        const sm = smat[k0 + (ty > 0.5 ? sw : 0) + (tx > 0.5 ? 1 : 0)];
        const m = mat[i]; const B = bodies[body[i]];
        if (d < PR) {
          const pen = PR - d;
          x[i] += nxw * pen; y[i] += nyw * pen;
          // tangential friction & restitution in position space
          const dpx = x[i] - ox[i], dpy = y[i] - oy[i];
          const dn = dpx * nxw + dpy * nyw;
          const tpx = dpx - dn * nxw, tpy = dpy - dn * nyw;
          const fr = Math.min(0.95, Math.sqrt(M.fric[m] * SURF_FRIC[sm] + 1e-6) * B.fricMul + (SURF_FRIC[sm] > 0.2 ? SURF_FRIC[sm] * 0.3 : 0));
          x[i] -= tpx * fr; y[i] -= tpy * fr;
          const rest = Math.max(M.rest[m], SURF_REST[sm]);
          if (rest > 0 && dn < 0) {
            // reflect normal component of the incoming velocity
            const vn = (dn) / dt; // negative (into wall) before push? use pre-push estimate
            const vin = -(vn - pen / dt);
            if (vin > 30) {
              ox[i] = x[i] - (tpx * (1 - fr)) - nxw * vin * rest * dt;
              oy[i] = y[i] - (tpy * (1 - fr)) - nyw * vin * rest * dt;
              if (sm === SURF.BOUNCE && vin > 60) this.events.bounce.push(i);
            }
          }
          contact[i] = 1 | (SURF_CLING[sm] || (M.cling[m] > 1 && sm !== SURF.BOUNCE) ? 2 : 0) | (sm === SURF.GRIT ? 4 : 0);
          cnx[i] = nxw; cny[i] = nyw;
          if (sm === SURF.ICE) this.temp[i] -= dt * 0.8;
          else if (sm === SURF.WARM) this.temp[i] += dt * 0.9;
        } else {
          contact[i] = 8 | (SURF_CLING[sm] || (M.cling[m] > 1 && sm !== SURF.BOUNCE) ? 2 : 0); cnx[i] = nxw; cny[i] = nyw;
        }
        // wetting adhesion: hyper-slick tangentially, micro-tacky normally
        const adh = (M.cling[m] > 1 ? Math.max(M.adh[m] * SURF_ADH[sm], M.adh[m] * 0.8) : M.adh[m] * SURF_ADH[sm]) * B.adhMul;
        if (adh > 0) {
          const t = 1 - Math.max(0, d - PR * 0.6) / (lim - PR * 0.6);
          if (t > 0) { const pull = adh * t * 0.22; x[i] -= nxw * pull; y[i] -= nyw * pull; }
        }
      }
    }
    // dynamic shapes
    const shapes = this.shapes;
    for (let s = 0; s < shapes.length; s++) {
      const S = shapes[s];
      if (!S.active) continue;
      const mx0 = S.bx0 - PR - ADH_RANGE, mx1 = S.bx1 + PR + ADH_RANGE, my0 = S.by0 - PR - ADH_RANGE, my1 = S.by1 + PR + ADH_RANGE;
      const out = this._sd || (this._sd = new Float32Array(3));
      const ca = Math.cos(S.angle), sa = Math.sin(S.angle);
      for (let i = 0; i < hi; i++) {
        if (!alive[i]) continue;
        const px = x[i], py = y[i];
        if (px < mx0 || px > mx1 || py < my0 || py > my1) continue;
        shapeSDF(S, px, py, ca, sa, out);
        const d = out[0];
        const lim = PR + ADH_RANGE;
        if (d >= lim) continue;
        const nxw = out[1], nyw = out[2];
        // one-way membranes: only resist motion against the allowed direction
        if (S.oneWay) {
          const vdot = (x[i] - ox[i]) * S.passX + (y[i] - oy[i]) * S.passY;
          if (vdot > -0.05) continue;
        }
        const m = mat[i]; const B = bodies[body[i]];
        const sm = S.surf;
        if (S.cut && d < PR + 2 && M.thick[m] < 1.5) {   // shear-thickened armour turns blades
          // blades sever: tag the particle with which side of the edge it sits
          const side = (px - S.x) * S.cnx + (py - S.y) * S.cny >= 0 ? 1 : -1;
          if (this.cutB[i] !== s || this.cutT[i] <= 0) { this.cutB[i] = s; this.cutS[i] = side; }
          this.cutT[i] = 0.35;
          this.events.cuts++;
        }
        // surface velocity at contact point
        const rx = px - S.x, ry = py - S.y;
        const svx = S.vx - S.omega * ry, svy = S.vy + S.omega * rx;
        if (d < PR) {
          const pen = PR - d;
          x[i] += nxw * pen; y[i] += nyw * pen;
          const dpx = (x[i] - ox[i]) - svx * dt, dpy = (y[i] - oy[i]) - svy * dt;
          const dn = dpx * nxw + dpy * nyw;
          const tpx = dpx - dn * nxw, tpy = dpy - dn * nyw;
          const fr = Math.min(0.95, Math.sqrt(M.fric[m] * SURF_FRIC[sm] + 1e-6) * B.fricMul + (S.grip || 0));
          x[i] -= tpx * fr; y[i] -= tpy * fr;
          const rest = Math.max(M.rest[m], SURF_REST[sm], S.rest || 0);
          if (rest > 0) {
            const vin = -dn / dt;
            if (vin > 30) {
              const vn = vin * rest;
              ox[i] = x[i] - (tpx * (1 - fr) + svx * dt) - nxw * vn * dt;
              oy[i] = y[i] - (tpy * (1 - fr) + svy * dt) - nyw * vn * dt;
              if (sm === SURF.BOUNCE && vin > 60) this.events.bounce.push(i);
            }
          }
          contact[i] = 1 | (SURF_CLING[sm] ? 2 : 0) | (sm === SURF.GRIT ? 4 : 0);
          cnx[i] = nxw; cny[i] = nyw;
          if (S.onTouch) S.onTouch(i);
        }
        const adh = M.adh[m] * SURF_ADH[sm] * B.adhMul;
        if (adh > 0 && !S.cut) {
          const t = 1 - Math.max(0, d - PR * 0.6) / (lim - PR * 0.6);
          if (t > 0) { const pull = adh * t * 0.22; x[i] -= nxw * pull; y[i] -= nyw * pull; }
        }
      }
    }
    // world bounds
    const bx0 = this.bx0 + 4, by0 = this.by0 + 4, bx1 = this.bx1 - 4, by1 = this.by1 - 4;
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      if (x[i] < bx0) x[i] = bx0; else if (x[i] > bx1) x[i] = bx1;
      if (y[i] < by0) y[i] = by0; else if (y[i] > by1) y[i] = by1;
    }
  }

  xsph(dt) {
    const { vx, vy, pi, pj, pc, np, mat, alive, hi, xsx, xsy, xsw, pa } = this;
    for (let i = 0; i < hi; i++) { xsx[i] = 0; xsy[i] = 0; xsw[i] = 0; }
    for (let p = 0; p < np; p++) {
      const a = pa[p]; if (a <= 0 || !pc[p]) continue;
      const i = pi[p], j = pj[p];
      const w = a * a;
      const dvx = vx[j] - vx[i], dvy = vy[j] - vy[i];
      xsx[i] += dvx * w; xsy[i] += dvy * w; xsw[i] += w;
      xsx[j] -= dvx * w; xsy[j] -= dvy * w; xsw[j] += w;
    }
    const f60 = Math.min(1, dt * 60);
    for (let i = 0; i < hi; i++) {
      if (!alive[i] || xsw[i] <= 0) continue;
      const c = M.xsph[mat[i]] * f60;
      const inv = c / Math.max(1, xsw[i]);
      vx[i] += xsx[i] * inv; vy[i] += xsy[i] * inv;
    }
  }

  // ── per-frame body aggregates ────────────────────────────────────────────
  aggregate(fd) {
    const { x, y, vx, vy, alive, hi, body, bodies, contact, cnx, cny, bcount, bodyIdx } = this;
    bcount.fill(0);
    for (const B of bodies) {
      if (!B.alive && !B._pending) continue;
      B._sx = 0; B._sy = 0; B._svx = 0; B._svy = 0; B.count = 0; B.contact = 0; B.clingContact = 0; B.cnx = 0; B.cny = 0; B.ccx = 0; B.ccy = 0;
      B.minx = 1e9; B.miny = 1e9; B.maxx = -1e9; B.maxy = -1e9; B._grit = 0;
    }
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      const b = body[i]; if (b < 0) continue;
      bcount[b]++;
      const B = bodies[b];
      B._sx += x[i]; B._sy += y[i]; B._svx += vx[i]; B._svy += vy[i];
      if (x[i] < B.minx) B.minx = x[i]; if (x[i] > B.maxx) B.maxx = x[i];
      if (y[i] < B.miny) B.miny = y[i]; if (y[i] > B.maxy) B.maxy = y[i];
      const c = contact[i];
      if (c & 1) { B.contact++; B.cnx += cnx[i]; B.cny += cny[i]; if (c & 2) { B.clingContact++; B.ccx += cnx[i]; B.ccy += cny[i]; } if (c & 4) B._grit++; }
    }
    // index lists
    let s = 0;
    for (let b = 0; b < this.maxb; b++) { const B = bodies[b]; B.start = s; B.len = 0; s += bcount[b]; }
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) continue;
      const b = body[i]; if (b < 0) continue;
      const B = bodies[b]; bodyIdx[B.start + B.len++] = i;
    }
    for (const B of bodies) {
      if (!B.alive && !B._pending) continue;
      const n = bcount[B.id];
      B.count = n;
      if (n === 0) {
        if (B._pending && B.age < 0.5) { B.age += fd; continue; }
        if (B.alive) { B.alive = false; B._died = true; }
        B._pending = false; continue;
      }
      B._pending = false; B.alive = true;
      B.age += fd;
      const inv = 1 / n;
      B.cx = B._sx * inv; B.cy = B._sy * inv; B.vx = B._svx * inv; B.vy = B._svy * inv;
      B.r = Math.sqrt(n * AREA_PER_P / Math.PI);
      if (B.contact > 0) { const l = Math.hypot(B.cnx, B.cny) || 1; B.cnx /= l; B.cny /= l; }
      if (B.clingContact > 0) { const l = Math.hypot(B.ccx, B.ccy) || 1; B.ccx /= l; B.ccy /= l; }
      // spin: angular velocity about the centre of mass (the crown of feelers rolls with the gel)
      if (fd > 0) {
        let Ls = 0, Is = 1e-6;
        for (let k = 0; k < n; k++) { const i = bodyIdx[B.start + k]; const rx = x[i] - B.cx, ry = y[i] - B.cy; Ls += rx * (vy[i] - B.vy) - ry * (vx[i] - B.vx); Is += rx * rx + ry * ry; }
        B.spin = Ls / Is;
      }
      // normalise lead weighting so locomotion force sums to the requested accel
      if (B.lead > 0) {
        let sw = 0;
        for (let k = 0; k < n; k++) {
          const i = bodyIdx[B.start + k];
          const ss = ((x[i] - B.cx) * B.lx + (y[i] - B.cy) * B.ly) / (B.r + 4);
          const t = ss < 0.1 ? 0 : ss > 1 ? 1 : (ss - 0.1) / 0.9;
          sw += 1 + B.lead * t * t * (3 - 2 * t);
        }
        B.leadNorm = n / Math.max(1e-3, sw);
      } else B.leadNorm = 1;
    }
  }

  // connected components → splits (fresh-cut passivation applied to the pieces)
  components() {
    const { pi, pj, pc, np, x, y, body, alive, hi, uf, bodies } = this;
    for (let i = 0; i < hi; i++) uf[i] = i;
    const find = (a) => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
    const L2 = (H * 0.92) * (H * 0.92);
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      if (!pc[p] || body[i] !== body[j]) continue;
      const dx = x[j] - x[i], dy = y[j] - y[i];
      if (dx * dx + dy * dy > L2) continue;
      const a = find(i), b = find(j);
      if (a !== b) { if (a < b) uf[b] = a; else uf[a] = b; }
    }
    // per body: gather root sizes
    const rootCount = new Map();
    for (let i = 0; i < hi; i++) {
      if (!alive[i] || body[i] < 0) continue;
      const r = find(i);
      const key = body[i] * 65536 + r;
      rootCount.set(key, (rootCount.get(key) || 0) + 1);
    }
    // find bodies with >1 root
    const byBody = new Map();
    for (const [key, cnt] of rootCount) {
      const b = Math.floor(key / 65536), r = key % 65536;
      let arr = byBody.get(b); if (!arr) { arr = []; byBody.set(b, arr); }
      arr.push([r, cnt]);
    }
    const remap = new Map();
    for (const [b, arr] of byBody) {
      if (arr.length < 2) continue;
      arr.sort((p, q) => q[1] - p[1]);
      const parent = bodies[b];
      for (let k = 1; k < arr.length; k++) {
        const nb = this.allocBody(parent.group, parent.kind === 'player' ? 'fragment' : parent.kind, parent.mat);
        if (!nb) break;
        nb.fuseT = Math.max(parent.fuseT, 0.55);
        nb.parentId = b; nb.tint = parent.tint;
        remap.set(b * 65536 + arr[k][0], nb.id);
        nb._size = arr[k][1];
      }
    }
    if (remap.size === 0) return;
    for (let i = 0; i < hi; i++) {
      if (!alive[i] || body[i] < 0) continue;
      const key = body[i] * 65536 + find(i);
      const nb = remap.get(key);
      if (nb !== undefined) body[i] = nb;
    }
    for (const [key, nb] of remap) {
      const parentId = Math.floor(key / 65536);
      bodies[parentId].fuseT = Math.max(bodies[parentId].fuseT, 0.45);
      if (this.onSplit) this.onSplit(bodies[parentId], bodies[nb]);
    }
    this.aggregate(0);
  }

  processMerges() {
    // cohesive contacts between different bodies → fusion
    const { pi, pj, pc, np, body, x, y, bodies } = this;
    const L2 = (H * 0.7) * (H * 0.7);
    const seen = new Set();
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      const bi = body[i], bj = body[j];
      if (bi === bj || bi < 0 || bj < 0) continue;
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const d2 = dx * dx + dy * dy;
      if (pc[p]) {
        if (d2 > L2) continue;
        const key = bi < bj ? bi * 4096 + bj : bj * 4096 + bi;
        if (seen.has(key)) continue; seen.add(key);
        this.events.merges.push([bi, bj]);
      } else if (this.ncontacts < 4096 && d2 < H * H * 0.6) {
        this.contactA[this.ncontacts] = i; this.contactB[this.ncontacts] = j; this.ncontacts++;
      }
    }
    for (const [bi, bj] of this.events.merges) {
      const A = bodies[bi], B = bodies[bj];
      if (!A.alive || !B.alive || A.count === 0 || B.count === 0) continue;
      // keeper: focused/controlled wins, else the larger
      let keep = A, gone = B;
      const pa = A.ctrl && A.ctrl.focused ? 2 : 0, pb = B.ctrl && B.ctrl.focused ? 2 : 0;
      if (pb > pa || (pb === pa && B.count > A.count)) { keep = B; gone = A; }
      if (gone.group === -1 && keep.group !== -1) { /* dew absorbed */ }
      else if (keep.group === -1 && gone.group !== -1) { const t = keep; keep = gone; gone = t; }
      this.mergeInto(keep, gone);
    }
  }

  mergeInto(keep, gone) {
    const { body, alive, hi } = this;
    for (let k = 0; k < gone.len; k++) {
      const i = this.bodyIdx[gone.start + k];
      if (alive[i] && body[i] === gone.id) { body[i] = keep.id; this.glow[i] = 1; }
    }
    // also sweep in case lists are stale
    for (let i = 0; i < hi; i++) if (alive[i] && body[i] === gone.id) body[i] = keep.id;
    const gc = gone.count;
    keep.count += gc; gone.count = 0;
    if (this.onMerge) this.onMerge(keep, gone, gc);
    gone.alive = false; gone._pending = false;
    this.bcount[gone.id] = 0;
  }

  // reassign a particle to another body (absorption / siphoning)
  transfer(i, toBody) { this.body[i] = toBody; this.glow[i] = 1; for (let k = 0; k < SPR; k++) this.sj[i * SPR + k] = -1; }

  // ── queries ──────────────────────────────────────────────────────────────
  forEachNear(px, py, r, cb) {
    const { x, y, sorted, cellStart, gw, gh, bx0, by0 } = this;
    const inv = 1 / this.cell;
    const cx0 = Math.max(0, ((px - r - bx0) * inv) | 0), cx1 = Math.min(gw - 1, ((px + r - bx0) * inv) | 0);
    const cy0 = Math.max(0, ((py - r - by0) * inv) | 0), cy1 = Math.min(gh - 1, ((py + r - by0) * inv) | 0);
    const r2 = r * r;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * gw + cx;
      for (let s = cellStart[c], e = cellStart[c + 1]; s < e; s++) {
        const i = sorted[s];
        if (!this.alive[i]) continue;
        const dx = x[i] - px, dy = y[i] - py;
        if (dx * dx + dy * dy < r2) cb(i, dx, dy);
      }
    }
  }

  sampleSDF(px, py) {
    const s = this.sdf; if (!s) return 1e9;
    let fx = (px - s.x0) / s.res, fy = (py - s.y0) / s.res;
    if (fx < 0 || fy < 0 || fx > s.w - 1.001 || fy > s.h - 1.001) return -50;
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    const k0 = iy * s.w + ix, d = s.data;
    return (d[k0] + (d[k0 + 1] - d[k0]) * tx) * (1 - ty) + (d[k0 + s.w] + (d[k0 + s.w + 1] - d[k0 + s.w]) * tx) * ty;
  }
  sdfNormal(px, py, out) {
    const e = 2;
    const gx = this.sampleSDF(px + e, py) - this.sampleSDF(px - e, py);
    const gy = this.sampleSDF(px, py + e) - this.sampleSDF(px, py - e);
    const l = Math.hypot(gx, gy) || 1; out[0] = gx / l; out[1] = gy / l; return out;
  }
  // raycast against static SDF (sphere tracing)
  raycast(x0, y0, dx, dy, maxD, out) {
    let t = 0;
    for (let k = 0; k < 96 && t < maxD; k++) {
      const d = this.sampleSDF(x0 + dx * t, y0 + dy * t);
      if (d < 1.5) { if (out) { out.t = t; out.x = x0 + dx * t; out.y = y0 + dy * t; } return true; }
      t += Math.max(d * 0.9, 1.5);
    }
    return false;
  }
  clear() {
    for (let i = 0; i < this.hi; i++) { this.alive[i] = 0; this.body[i] = -1; }
    this.hi = 0; this.count = 0; this.nfree = 0;
    for (const B of this.bodies) { B.reset(); B._pending = false; }
    this.bcount.fill(0);
    this.sj.fill(-1);
    this.shapes = []; this.zones = [];
  }
}

// ── dynamic shape SDFs (CPU mirror of the GPU versions) ─────────────────────
export function shapeSDF(S, px, py, ca, sa, out) {
  const dx = px - S.x, dy = py - S.y;
  const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
  let d, gx, gy;
  if (S.type === 0) { // circle
    const l = Math.hypot(lx, ly) || 1e-5; d = l - S.r; gx = lx / l; gy = ly / l;
  } else if (S.type === 1) { // capsule along local x, half-length S.hl
    const cx = Math.max(-S.hl, Math.min(S.hl, lx));
    const ex = lx - cx, ey = ly; const l = Math.hypot(ex, ey) || 1e-5;
    d = l - S.r; gx = ex / l; gy = ey / l;
  } else if (S.type === 2) { // rounded box half extents hw, hh, rounding r
    const qx = Math.abs(lx) - S.hw + S.r, qy = Math.abs(ly) - S.hh + S.r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const lo = Math.hypot(ox, oy);
    const inside = Math.min(Math.max(qx, qy), 0);
    d = lo + inside - S.r;
    if (lo > 1e-5) { gx = ox / lo * Math.sign(lx); gy = oy / lo * Math.sign(ly); }
    else if (qx > qy) { gx = Math.sign(lx); gy = 0; } else { gx = 0; gy = Math.sign(ly); }
  } else if (S.type === 3) { // ring (annulus) radius R thickness r, with optional gap
    const l = Math.hypot(lx, ly) || 1e-5;
    let ang = Math.atan2(ly, lx);
    if (S.gap && Math.abs(ang) < S.gap) {
      // gap centred on local +x: distance to gap end caps
      const g = S.gap; const e1x = Math.cos(g) * S.R, e1y = Math.sin(g) * S.R * Math.sign(ly || 1);
      const ex = lx - e1x, ey = ly - e1y; const le = Math.hypot(ex, ey) || 1e-5;
      d = le - S.r; gx = ex / le; gy = ey / le;
    } else {
      const s = l - S.R; d = Math.abs(s) - S.r; const sg = s >= 0 ? 1 : -1; gx = lx / l * sg; gy = ly / l * sg;
    }
  } else {
    d = 1e9; gx = 0; gy = -1;
  }
  out[0] = d; out[1] = gx * ca - gy * sa; out[2] = gx * sa + gy * ca;
  return out;
}

export function updateShapeBounds(S) {
  const ext = S.type === 0 ? S.r : S.type === 1 ? S.hl + S.r : S.type === 2 ? Math.hypot(S.hw, S.hh) : (S.R + S.r);
  S.bx0 = S.x - ext; S.bx1 = S.x + ext; S.by0 = S.y - ext; S.by1 = S.y + ext;
  // cutting edge normal (for blades: local y axis)
  S.cnx = -Math.sin(S.angle); S.cny = Math.cos(S.angle);
}

export function makeShape(o) {
  const S = Object.assign({ type: 0, x: 0, y: 0, angle: 0, vx: 0, vy: 0, omega: 0, r: 10, hl: 0, hw: 10, hh: 10, R: 0, gap: 0,
    surf: SURF.METAL, active: true, cut: false, oneWay: false, passX: 0, passY: -1, rest: 0, grip: 0 }, o);
  updateShapeBounds(S);
  return S;
}

// kinematic move helper: sets velocity from displacement so contacts carry
export function moveShape(S, nx, ny, nang, dt) {
  S.vx = (nx - S.x) / dt; S.vy = (ny - S.y) / dt;
  let da = nang - S.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  S.omega = da / dt;
  S.x = nx; S.y = ny; S.angle = nang;
  updateShapeBounds(S);
}
