// ─────────────────────────────────────────────────────────────────────────────
//  Odyssey mode — the solo micro-odyssey (chambers, stars, celebration).
// ─────────────────────────────────────────────────────────────────────────────
import { CHAMBERS } from '../levels/odyssey.js';
import { sound } from '../audio/audio.js';
import { Mote, Prism } from '../game/entities.js';
import { save } from '../game/save.js';
import { MAT } from '../engine/materials.js';
import { TINTS } from '../game/tints.js';

export class OdysseyMode {
  constructor(G, index = 0, app) {
    this.G = G; this.index = index; this.app = app;
  }
  enter() {
    const G = this.G;
    const L = CHAMBERS[this.index];
    this.L = L;
    G.load(L);
    G.addColony(0, L.spawn[0], L.spawn[1], L.mass, { layer: 0 });
    G.cam.snap(L.spawn[0], L.spawn[1] + 100, G.baseZoom() * 0.92);
    this.totalMotes = G.ents.filter(e => e instanceof Mote).length;
    this.totalPrisms = G.ents.filter(e => e instanceof Prism).length;
    this.motes = 0; this.prisms = 0;
    this.time = 0; this.done = false; this.lost = 0; this.tricks = new Set(); this.peakChain = 0;
    this.exitT = 0; this.respawns = 0;
    G.hud.showTitle(L.name, L.sub);
    G.hud.setCorner(true, () => this.pause());
    sound.setKey(L.key[0], L.key[1]); sound.ambience(L.amb, L.key[0]);
    G.onMote = (m, B, chain) => { this.motes++; this.peakChain = Math.max(this.peakChain, chain); if (chain === 12) this.trick('Gathering Song'); };
    G.onPrism = () => { this.prisms++; };
    G.onHurt = (n) => { this.lost += n; G.R.danger[3] = Math.min(1, G.R.danger[3] + 0.25 * n); };
    G.onCut = () => { this.cutT = G.t; };
    G.onFuse = (k, g, n) => { if (this.cutT && G.t - this.cutT < 5) { this.trick('Surgical Shear'); this.cutT = 0; } };
    G.onLantern = () => {};
    G.onGhost = () => this.trick('Ghost Wall', '◌');
    G.complete = (exit) => this.complete(exit);
    this.updateCounter();
    this.airT = 0; this.wallT = 0; this.squeezeMax = 0;
  }
  exit() { const G = this.G; G.onMote = G.onPrism = G.onHurt = G.onCut = G.onFuse = G.onLantern = G.onGhost = null; G.hud.clearHints(); }

  trick(name, glyph = '✦') {
    if (this.tricks.has(name)) { this.G.hud.toast(name, glyph); return; }
    this.tricks.add(name); this.G.hud.toast(name, glyph); sound.trick();
  }
  updateCounter() { this.G.hud.setCounter(this.motes, this.totalMotes, this.prisms, this.totalPrisms); }

  pause() {
    const G = this.G; if (this.done) return;
    G.paused = true; sound.ui();
    G.hud.openMenu('Paused', [
      { label: 'Resume', cls: 'primary', fn: () => { G.hud.closeMenu(); G.paused = false; } },
      { label: 'Restart chamber', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.startOdyssey(this.index); } },
      { label: 'Chambers', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.chamberMap(); } },
      { label: sound.muted ? 'Sound: off' : 'Sound: on', fn: () => { sound.setMuted(!sound.muted); save.set('muted', sound.muted); this.pause(); } },
      { label: `Quality: ${['light', 'balanced', 'high'][Math.max(0, Math.min(2, G.R.quality))]}`, fn: () => { const nq = (G.R.quality + 1) % 3; G.R.setQuality(nq); save.set('quality', nq); this.pause(); } },
      { label: 'Atrium', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.hub(); } },
    ], `${this.L.name}`);
  }

  events(evs) {
    const G = this.G, C = G.colony;
    for (const e of evs) {
      if (e.type === 'pause') { if (G.hud.menuOpen) { G.hud.closeMenu(); G.paused = false; } else this.pause(); continue; }
      if (G.paused || this.done || !C) continue;
      const F = C.focus;
      if (e.type === 'dart' && F) {
        let dx = e.x, dy = e.y;
        if (e.key) { const m = G.input.move; if (Math.hypot(m.x, m.y) > 0.2) { dx = m.x; dy = m.y; } else { dx = F.facing.x; dy = F.facing.y; } }
        F.dart(dx, dy, e.power || 1);
      } else if (e.type === 'bud' && F && this.L.bud !== false) {
        let tx, ty;
        if (e.aimed) [tx, ty] = G.screenToWorld(e.x, e.y);
        else if (G.input.mouse.inside && performance.now() - G.input.mouse.t < 4000 && G.input.device !== 'pad') [tx, ty] = G.screenToWorld(G.input.mouse.x, G.input.mouse.y);
        else { const m = G.input.move; const d = Math.hypot(m.x, m.y) > 0.2 ? m : F.facing; tx = F.B.cx + d.x * 200; ty = F.B.cy + d.y * 200; }
        F.bud(tx, ty, 0.4);
      } else if (e.type === 'focusNext') C.cycle(e.dir);
      else if (e.type === 'tap') G.pickFocus(e.x, e.y);
      else if (e.type === 'rallyPulse') {}
    }
  }

  update(dt) {
    const G = this.G, C = G.colony;
    if (!C) return;
    if (!this.done) this.time += dt;
    // the Hand of the World: some chambers turn gravity itself
    if (this.L.gravityRot) { const a = this.time * this.L.gravityRot + (this.L.gravityPhase || 0); const g = this.L.gravity[1]; G.phys.gx = Math.sin(a) * g; G.phys.gy = Math.cos(a) * g; }
    const intent = this.done ? { x: 0, y: 0 } : G.input.move;
    C.update(dt, intent, G.input.rally && !this.done);
    // survival floor: never zero — desperation form keeps you in the game
    const mass = C.mass;
    if (mass === 0 || !C.focus) this.rebirth();
    else if (mass < 30 && C.focus) { C.focus.speedMul = 1.35; } else if (C.focus) C.focus.speedMul = 1;
    // fell out of the world?
    if (C.focus && C.focus.B.cy > this.L.bounds[3] + 200) this.rebirth();
    // tricks: long wall-run, pearl drop, thread the needle
    const F = C.focus;
    if (F && F.alive) {
      const clinging = F.B.clingContact > 0 && !F.ground && F.lastContact === 0 && Math.hypot(F.B.vx, F.B.vy) > 60;
      this.wallT = clinging ? this.wallT + dt : Math.max(0, this.wallT - dt * 2);
      if (this.wallT > 2.2 && !this._wr) { this._wr = true; this.trick('Wall Runner'); }
      if (F.lastContact > 0) this.airT += dt; else { if (this.airT > 1.1) this.trick('Pearl Drop'); this.airT = 0; }
      if (F.squeeze > 0.75) this.squeezeMax = 1;
      if (this.squeezeMax && F.squeeze < 0.15) { this.squeezeMax = 0; this.trick('Thread the Needle'); }
    }
    this.updateCounter();
    G.hud.sweepHints();
    // exit suction animation
    if (this.done && this.exitAt) {
      this.exitT += dt;
      for (const O of C.orgs) {
        if (!O.alive) continue;
        const dx = this.exitAt.x - O.B.cx, dy = this.exitAt.y - O.B.cy, d = Math.hypot(dx, dy) + 1;
        O.B.ax = dx / d * 1800; O.B.ay = dy / d * 1800; O.B.gs = 0; O.B.tonus = 60; O.B.lead = 0;
      }
      const P = G.phys;
      P.forEachNear(this.exitAt.x, this.exitAt.y, 26, (i) => { if (G.isPlayerBody(P.bodies[P.body[i]])) { G.fx.add({ x: P.x[i], y: P.y[i], vx: 0, vy: 0, life: 0.5, size: 7, type: 0, r: 0.8, g: 0.95, b: 1, a: 1, grow: -12 }); P.kill(i); } });
    }
  }

  rebirth() {
    const G = this.G; const cp = G.checkpoint;
    this.respawns++;
    const C = G.colony;
    for (const O of C.orgs) if (O.alive) { const P = G.phys; for (let k = 0; k < O.B.len; k++) P.kill(P.bodyIdx[O.B.start + k]); }
    C.orgs = []; C.focus = null;
    const O = C.spawn(cp.x, cp.y, Math.max(60, Math.min(this.L.mass, 90)));
    G.fx.ring(cp.x, cp.y, [1, 0.8, 0.6], 140, 0.8);
    sound.bloom();
  }

  complete(exit) {
    if (this.done) return;
    this.done = true; this.exitAt = exit;
    const G = this.G;
    sound.portal();
    G.fx.ring(exit.x, exit.y, [0.6, 0.95, 1], 260, 1.4);
    G.R.post.flash = [0.5, 0.8, 1.0, 0];
    G.input.enabled = false;
    const mass = G.colony.mass;
    if (this.L.finale) { this.finale(mass); return; }
    setTimeout(() => this.results(mass), 1500);
  }

  // the Glass Sea is lit: every lantern blooms, gravity stills, dawn floods the drum
  finale(mass) {
    const G = this.G, R = G.R;
    this.L.gravityRot = 0; G.phys.gx = 0; G.phys.gy = 0;
    sound.bloom(); setTimeout(() => sound.portal(), 700); setTimeout(() => sound.bloom(), 1600);
    const from = { ...R.pal }, to = { p0: [0.05, 0.03, 0.04], p1: [0.22, 0.12, 0.12], p2: [0.3, 0.2, 0.2], p3: [1, 0.85, 0.7], sky: [1, 0.85, 0.7] };
    let t = 0;
    const step = () => {
      t += 1 / 60;
      const k = Math.min(1, t / 4);
      for (const key of ['p0', 'p1', 'p2', 'p3', 'sky']) R.pal[key] = from[key].map((v, i) => v + (to[key][i] - v) * k * k);
      if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2, r = 100 + Math.random() * 700; G.fx.add({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: -40 - Math.random() * 60, life: 2.5, size: 3 + Math.random() * 3, type: 0, r: 1, g: 0.8, b: 0.6, a: 0.9, drag: 0.2 }); }
      if (t < 4.5) requestAnimationFrame(step);
    };
    step();
    for (let k = 0; k < 6; k++) setTimeout(() => G.fx.ring(0, 0, [1, 0.8, 0.65], 400 + k * 180, 1.6, { a: 0.6 }), k * 280);
    setTimeout(() => {
      const total = save.starsTotal();
      G.hud.showCard(`
        <div class="c-head">the glass sea is lit</div>
        <div class="c-name">Myria</div>
        <div style="font-size:13px;letter-spacing:.14em;line-height:1.9;color:rgba(230,245,255,.75);max-width:380px;margin:0 auto 14px">
          a drop of living light, gathered from the dark,<br>split into a myriad, and made whole again.
        </div>
        <div class="stats" style="grid-template-columns:1fr"><span>stars gathered across the odyssey <b>${total} / ${CHAMBERS.length * 3}</b></span></div>
        <div class="tricks"><span>thank you for playing</span></div>
      `, [
        { label: 'Atrium', cls: 'primary', fn: () => { G.hud.hideCard(); G.input.enabled = true; this.app.hub(); } },
        { label: 'Chambers', fn: () => { G.hud.hideCard(); G.input.enabled = true; this.app.chamberMap(); } },
      ]);
      this.results(mass, true);
    }, 4800);
  }

  results(mass, silent = false) {
    const G = this.G, L = this.L;
    G.input.enabled = true;
    if (silent) {
      const light = this.totalMotes ? this.motes / this.totalMotes : 1;
      save.recordChamber(L.id, { stars: [light >= 0.9, this.prisms >= this.totalPrisms, this.time <= L.par], time: this.time, motes: this.motes, prisms: this.prisms });
      save.set('finished', true);
      return;
    }
    const light = this.totalMotes ? this.motes / this.totalMotes : 1;
    const s1 = light >= 0.9, s2 = this.prisms >= this.totalPrisms, s3 = this.time <= L.par;
    const stars = [s1, s2, s3];
    const before = save.starsTotal();
    const rec = save.recordChamber(L.id, { stars, time: this.time, motes: this.motes, prisms: this.prisms });
    const after = save.starsTotal();
    const awakened = TINTS.filter(t => t.stars > before && t.stars <= after);
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const starHtml = [['Light', s1], ['Prisms', s2], ['Grace', s3]].map(([n, on], i) => `<div class="star ${on ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.22}s"><div class="s"></div>${n}</div>`).join('');
    const tricks = [...this.tricks].map(t => `<span>${t}</span>`).join('');
    const next = this.index + 1 < CHAMBERS.length;
    G.hud.showCard(`
      <div class="c-head">chamber restored</div>
      <div class="c-name">${L.name}</div>
      <div class="stars">${starHtml}</div>
      <div class="stats">
        <span>light gathered <b>${this.motes}/${this.totalMotes}</b></span><span>prisms <b>${this.prisms}/${this.totalPrisms}</b></span>
        <span>time <b>${fmt(this.time)}</b></span><span>grace par <b>${fmt(L.par)}</b></span>
        <span>mass carried <b>${mass}</b></span><span>best melody <b>${this.peakChain}</b></span>
      </div>
      ${tricks ? `<div class="tricks">${tricks}</div>` : ''}
      ${rec.newBest ? '<div class="c-head" style="margin-top:12px;color:#ffd0a0">new personal best</div>' : ''}
      ${awakened.map(t => `<div class="c-head" style="margin-top:12px;color:rgb(${t.swatch.map(v => Math.round(v * 255)).join(',')})">◉ a new pigment awakens · ${t.name}</div>`).join('')}
    `, [
      ...(next ? [{ label: 'Onward', cls: 'primary', fn: () => { G.hud.hideCard(); this.app.startOdyssey(this.index + 1); } }] : [{ label: 'Atrium', cls: 'primary', fn: () => { G.hud.hideCard(); this.app.hub(); } }]),
      { label: 'Again', fn: () => { G.hud.hideCard(); this.app.startOdyssey(this.index); } },
      { label: 'Chambers', fn: () => { G.hud.hideCard(); this.app.chamberMap(); } },
    ]);
  }

  draw(D) {
    // the open iris whispers its direction from the screen edge
    const G = this.G; if (this.done) return;
    const X = G.ents.find(e => e.d && e.d.type === 'exit');
    if (!X || X.open < 0.5) return;
    const [sx, sy] = G.worldToScreen(X.x, X.y);
    const w = G.canvas.clientWidth, h = G.canvas.clientHeight, m = 26;
    if (sx > 0 && sx < w && sy > 0 && sy < h) return;
    const cx = w / 2, cy = h / 2; let dx = sx - cx, dy = sy - cy;
    const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-6), (h / 2 - m) / Math.abs(dy || 1e-6));
    const ex = cx + dx * k, ey = cy + dy * k;
    const [wx, wy] = G.screenToWorld(ex, ey);
    const z = G.cam.zoom; const pulse = 0.5 + 0.5 * Math.sin(G.t * 2.4);
    D.fxTop.push(wx, wy, 16 / z, 5, 0.5, 0.9, 1.0, 0.35 + 0.3 * pulse, 0, 0, 0, 0);
    D.fxTop.push(wx, wy, 5 / z, 0, 0.8, 0.95, 1.0, 0.8, 0, 0, 0, 0);
  }

  camera(cam, dt) {
    const G = this.G, C = G.colony;
    if (this.done && this.exitAt) { cam.tx = this.exitAt.x; cam.ty = this.exitAt.y; cam.tz = G.baseZoom() * 1.25; return; }
    const F = C && C.focus;
    if (!F || !F.alive) return;
    cam.tx = F.B.cx + F.B.vx * 0.25; cam.ty = F.B.cy + F.B.vy * 0.15 - 30;
    cam.tz = G.baseZoom() * Math.pow(140 / Math.max(50, F.B.count), 0.16);
  }
}
