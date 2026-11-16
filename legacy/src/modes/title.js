// ─────────────────────────────────────────────────────────────────────────────
//  Title & Atrium — the wordless 3-second hook.
//  Glass letters breathe in the dark. Your touch melts them into living light,
//  which gathers into one creature that reaches for your finger. The world opens:
//  a floating dish whose portals are the menu. You learn to move by choosing.
// ─────────────────────────────────────────────────────────────────────────────
import { SPACING, AREA_PER_P } from '../engine/physics.js';
import { MAT, SURF } from '../engine/materials.js';
import { sound } from '../audio/audio.js';
import { save } from '../game/save.js';
import { TINTS, unlocked } from '../game/tints.js';

const TAU = Math.PI * 2;

export const ATRIUM = {
  id: 'atrium', bounds: [-900, -760, 900, 760], view: 1500, gravity: [0, 0], drag: 0.35,
  palette: { p0: [0.002, 0.005, 0.014], p1: [0.007, 0.02, 0.05], p2: [0.05, 0.065, 0.1], p3: [0.6, 0.75, 1.0], sky: [0.55, 0.65, 0.95], grid: 0.8 },
  geo: [
    { op: 'carve', t: 'circle', x: 0, y: 0, r: 660 },
    { op: 'add', t: 'ellipse', x: 0, y: 0, rx: 70, ry: 70, mat: SURF.GLASS, a: 0, _skip: true },
  ].filter(o => !o._skip),
  entities: [],
};

function glyphPoints(text, height) {
  const c = document.createElement('canvas');
  const fs = 200;
  const ctx = c.getContext('2d');
  ctx.font = `600 ${fs}px "Avenir Next", "Avenir", "Futura", "Segoe UI", system-ui, sans-serif`;
  const spacing = fs * 0.16;
  let w = 0; const widths = [];
  for (const ch of text) { const m = ctx.measureText(ch).width; widths.push(m); w += m + spacing; }
  w -= spacing;
  c.width = Math.ceil(w + 40); c.height = Math.ceil(fs * 1.3);
  ctx.font = `600 ${fs}px "Avenir Next", "Avenir", "Futura", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  let x = 20;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x, c.height / 2); x += widths[i] + spacing; });
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const scale = height / fs;
  const pts = [];
  const step = SPACING * 1.07 / scale;
  for (let yy = 0, row = 0; yy < c.height; yy += step * 0.866, row++) {
    for (let xx = (row % 2) * step * 0.5; xx < c.width; xx += step) {
      const a = img[((yy | 0) * c.width + (xx | 0)) * 4 + 3];
      if (a > 140) pts.push([(xx - c.width / 2) * scale, (yy - c.height / 2) * scale]);
    }
  }
  return pts;
}

export class TitleMode {
  constructor(G, app, opts = {}) { this.G = G; this.app = app; this.skipIntro = !!opts.skipIntro; }

  enter() {
    const G = this.G;
    const fresh = !save.chamber('first-light');
    this.fresh = fresh;
    const L = {
      ...ATRIUM,
      entities: [
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(k => { const a = k / 12 * TAU + 0.2; const r = 230 + (k % 3) * 70; return { type: 'mote', x: Math.cos(a) * r, y: Math.sin(a) * r, value: 2, free: true }; }).filter(m => !fresh || Math.abs(m.x) > 60 || m.y > 0),
        // first visit: a trail of light leads to the Odyssey
        ...(fresh ? [0, 1, 2, 3, 4].map(k => ({ type: 'mote', x: Math.sin(k * 0.9) * 10, y: -95 - k * 55, value: 2 })) : []),
        { type: 'hint', x: 0, y: 0, hx: 0, hy: 110, kind: 'drag', after: 4, r: 200 },
      ],
    };
    G.load(L);
    this.portals = [
      { id: 'odyssey', label: 'Odyssey', sub: `${save.starsTotal()} ★`, x: 0, y: -420, col: [1.0, 0.72, 0.45] },
      { id: 'bloom', label: 'Bloom', sub: 'grow · devour', x: 420, y: 0, col: [0.45, 1.0, 0.7] },
      { id: 'pool', label: 'Kneading Pool', sub: 'play', x: 0, y: 420, col: [0.75, 0.6, 1.0] },
      { id: 'duet', label: 'Duet', sub: 'two on one screen', x: -420, y: 0, col: [1.0, 0.55, 0.75] },
    ];
    for (const p of this.portals) { p.open = 0; p.hover = 0; p.t = Math.random() * 5; }
    // the wardrobe: living pigments on a slow orbit between the portals
    this.pigments = TINTS.map((t, k) => ({ ...t, a: -Math.PI / 2 + Math.PI / 4 + k * (Math.PI * 2 / TINTS.length), on: unlocked(t), cool: 0 }));
    this.state = this.skipIntro ? 'hub' : 'glass';
    this.t = 0;
    G.hud.setCorner(false);
    G.hud.hideCounter();
    this.labels = document.createElement('div');
    this.labels.className = 'labels';
    G.hud.root.appendChild(this.labels);
    this.portals.forEach(p => { const e = document.createElement('div'); e.className = 'portal-label'; e.style.opacity = 0; e.innerHTML = `${p.label}<small>${p.sub}</small>`; this.labels.appendChild(e); p.el = e; });
    const C = G.addColony(0, 0, 0, 1, {});
    // remove the seed particle; title letters become the body
    for (const O of C.orgs) { const P = G.phys; for (let i = 0; i < P.hi; i++) if (P.alive[i]) P.kill(i); }
    C.orgs = []; C.focus = null;
    if (this.state === 'glass') this.makeGlyphs(C); else this.birthDirect(C);
    G.cam.snap(0, 0, this.glassZoom());
    G.R.post.fade = this.skipIntro ? 1 : 0;
    this.pulseT = 0;
  }
  exit() { this.labels.remove(); }

  glassZoom() { const w = this.G.canvas.clientWidth, h = this.G.canvas.clientHeight; return Math.min(w / 1250, h / 560); }
  hubZoom() { const w = this.G.canvas.clientWidth, h = this.G.canvas.clientHeight; return Math.min(w / 1500, h / 1180); }

  makeGlyphs(C) {
    const G = this.G, P = G.phys;
    const pts = glyphPoints('MYRIA', 175);
    const B = P.allocBody(0, 'player', MAT.GLYPH);
    for (const [x, y] of pts) P.spawn(x, y, 0, 0, MAT.GLYPH, B.id);
    B.count = pts.length; B.cx = 0; B.cy = 0; B.r = Math.sqrt(pts.length * AREA_PER_P / Math.PI); B.alive = true;
    const O = C.adopt(B); O.dormant = true; C.setFocus(O);
    this.glyphCount = pts.length;
  }
  birthDirect(C) { const O = C.spawn(0, 0, 150); this.state = 'hub'; this.t = 3; }

  melt(wx, wy) {
    const G = this.G, P = G.phys, C = G.colony;
    this.state = 'melt'; this.t = 0; this.meltAt = { x: wx, y: wy };
    sound.init(); sound.setKey(50, 'lydian'); sound.ambience('deep', 50); sound.bloom();
    for (const O of C.orgs) { O.dormant = false; }
    // glass → life
    for (let i = 0; i < P.hi; i++) if (P.alive[i]) { P.mat[i] = MAT.LUMEN; P.glow[i] = 0.3 + Math.random() * 0.4; }
    for (const O of C.orgs) O.B.mat = MAT.LUMEN;
    G.fx.ring(wx, wy, [1, 0.8, 0.6], 160, 0.9, { a: 0.6 });
    G.R.post.flash = [1, 0.75, 0.55, 0.12];
  }

  events(evs) {
    const G = this.G;
    for (const e of evs) {
      if (this.state === 'glass' && (e.type === 'press' || e.type === 'key')) {
        let wx = 0, wy = 0;
        if (e.type === 'press') [wx, wy] = G.screenToWorld(e.x, e.y);
        this.melt(wx, wy);
      } else if (this.state === 'hub') {
        const F = G.colony && G.colony.focus;
        if (!F) continue;
        if (e.type === 'dart') { let dx = e.x, dy = e.y; if (e.key) { const m = G.input.move; if (Math.hypot(m.x, m.y) > 0.2) { dx = m.x; dy = m.y; } else { dx = F.facing.x; dy = F.facing.y; } } F.dart(dx, dy, e.power || 1); }
        if (e.type === 'bud') { let tx, ty; if (e.aimed) [tx, ty] = G.screenToWorld(e.x, e.y); else { const d = F.facing; tx = F.B.cx + d.x * 200; ty = F.B.cy + d.y * 200; } F.bud(tx, ty, 0.35); }
        if (e.type === 'focusNext') G.colony.cycle(e.dir);
        if (e.type === 'tap') G.pickFocus(e.x, e.y);
        if (e.type === 'pause') this.settings();
      }
    }
  }

  settings() {
    const G = this.G; G.paused = true;
    const q = G.R.quality;
    G.hud.openMenu('Myria', [
      { label: 'Resume', cls: 'primary', fn: () => { G.hud.closeMenu(); G.paused = false; } },
      { label: sound.muted ? 'Sound: off' : 'Sound: on', fn: () => { sound.setMuted(!sound.muted); this.settings(); } },
      { label: `Quality: ${q >= 2 ? 'high' : q >= 1 ? 'balanced' : 'light'}`, fn: () => { const nq = q >= 2 ? 0 : q + 1; G.R.setQuality(nq); save.set('quality', nq); this.settings(); } },
      { label: 'Chambers', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.chamberMap(); } },
    ], 'a drop of living light');
  }

  update(dt) {
    const G = this.G, C = G.colony;
    this.t += dt;
    const P = G.phys;
    if (!this.leaving) G.R.post.fade = Math.min(1, G.R.post.fade + dt / 2.2);
    if (this.state === 'glass') {
      // a slow glint sweeps across the glass
      const sweep = ((this.t * 0.22) % 1.6) - 0.3;
      for (let k = 0; k < 2; k++) {
        const x = -480 + sweep * 960 + (Math.random() - 0.5) * 30, y = (Math.random() - 0.5) * 200;
        G.fx.add({ x, y, life: 0.3, size: 9, type: 0, r: 0.7, g: 0.9, b: 1, a: 0.5, mask: 1 });
      }
      this.pulseT += dt;
      if (this.pulseT > 2.6 && this.t > 3) { this.pulseT = 0; G.fx.ring(0, 160, [0.6, 0.85, 1.0], 60, 1.6, { a: 0.35 }); }
      if (C) C.update(dt, { x: 0, y: 0 }, false);
      return;
    }
    if (this.state === 'melt') {
      // living light gathers toward the touch, then becomes one
      const tgt = this.meltAt;
      for (const O of C.orgs) { O.seek = { x: tgt.x, y: tgt.y, k: 1100 }; O.B.fuseT = 0; }
      C.update(dt, { x: 0, y: 0 }, false);
      for (const O of C.orgs) O.seek = null;
      // evaporate the excess into rising sparks
      const mass = C.mass;
      const keep = 150;
      if (this.t > 0.9 && mass > keep) {
        const n = Math.min(mass - keep, Math.ceil(mass * dt * 2.2));
        let killed = 0;
        for (let i = 0; i < P.hi && killed < n; i++) {
          if (!P.alive[i] || P.surf[i] < 0.3 || Math.random() < 0.6) continue;
          G.fx.add({ x: P.x[i], y: P.y[i], vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 80, life: 1 + Math.random(), size: 3, type: 0, r: 1, g: 0.8, b: 0.6, a: 0.8, drag: 0.5 });
          P.kill(i); killed++;
        }
      }
      if (this.t > 2.6 && C.orgs.length <= 3 && C.mass <= keep + 10) { this.state = 'hub'; this.t = 0; sound.open(); }
      if (this.t > 5) { this.state = 'hub'; this.t = 0; }
      return;
    }
    // hub
    C.update(dt, G.input.move, G.input.rally);
    G.hud.sweepHints();
    const F = C.focus;
    for (const p of this.portals) {
      p.t += dt;
      p.open += (Math.min(1, this.t / 1.5) - p.open) * Math.min(1, dt * 2);
      if (!F || !F.alive) continue;
      const d = Math.hypot(F.B.cx - p.x, F.B.cy - p.y);
      p.hover += ((d < 190 ? 1 : 0) - p.hover) * Math.min(1, dt * 4);
      if (d < 46 + F.B.r * 0.3 && p.open > 0.9 && !this.leaving) this.enterPortal(p);
      // a gentle well near each portal makes entering effortless
      if (d < 150 && !this.leaving) { F.cradle = { ax: (p.x - F.B.cx) * 2.2, ay: (p.y - F.B.cy) * 2.2, damp: 0 }; }
    }
    // pigments: touch an unlocked one to transform
    for (const pg of this.pigments) {
      pg.a += dt * 0.05; pg.cool = Math.max(0, pg.cool - dt);
      pg.x = Math.cos(pg.a) * 560; pg.y = Math.sin(pg.a) * 560;
      if (!F || !F.alive || pg.cool > 0) continue;
      const d = Math.hypot(F.B.cx - pg.x, F.B.cy - pg.y);
      if (d < F.B.r + 18) {
        pg.cool = 2;
        if (pg.on) {
          save.set('tint', pg.id);
          for (const O of C.orgs) { O.B.tint = pg.tint; const P = G.phys; for (let k = 0; k < O.B.len; k++) P.glow[P.bodyIdx[O.B.start + k]] = 1.2; }
          C.tint = pg.tint;
          sound.morph(); G.fx.ring(pg.x, pg.y, pg.swatch, 120, 0.8); G.hud.toast(pg.name, '◉');
        } else { sound.hurt(0.2); G.hud.toast(`${pg.stars} ★ to awaken`, '◌', 'cool'); }
      }
    }
    if (this.leaving) {
      this.leaveT += dt;
      const p = this.leaving;
      for (const O of C.orgs) { O.seek = { x: p.x, y: p.y, k: 1600 }; }
      P.forEachNear(p.x, p.y, 30, (i) => { if (P.alive[i]) { G.fx.add({ x: P.x[i], y: P.y[i], life: 0.4, size: 6, type: 0, r: p.col[0], g: p.col[1], b: p.col[2], a: 1, grow: -12 }); P.kill(i); } });
      G.R.post.fade = Math.max(0, 1 - this.leaveT / 1.3);
      if (this.leaveT > 1.35) { G.R.post.fade = 1; this.go(p.id); }
    }
  }

  enterPortal(p) {
    this.leaving = p; this.leaveT = 0;
    sound.portal();
    this.G.fx.ring(p.x, p.y, p.col, 240, 1.2);
  }
  go(id) {
    const a = this.app;
    if (id === 'odyssey') a.continueOdyssey();
    else if (id === 'bloom') a.startBloom();
    else if (id === 'pool') a.startPool();
    else if (id === 'duet') a.startDuet();
  }

  draw(D) {
    const G = this.G;
    if (this.state === 'glass') {
      // crystal glints: real lights skimming the glass
      const lx = Math.sin(this.t * 0.5) * 420;
      D.light(lx, -260, 160, 520, 0.7, 0.85, 1.0, 1.0);
      D.light(-lx * 0.6, 220, 120, 420, 1.0, 0.75, 0.55, 0.4);
    }
    if (this.state !== 'hub') return;
    for (const pg of this.pigments || []) {
      if (pg.x === undefined) continue;
      const cur = save.get('tint', 'ember') === pg.id;
      const c = pg.swatch, k = pg.on ? 1 : 0.22;
      D.ents.push(pg.x, pg.y, cur ? 22 : 15, 0, c[0] * k, c[1] * k, c[2] * k, 1, pg.a, 0, 0, 0);
      if (cur) D.ents.push(pg.x, pg.y, 30, 2, c[0], c[1], c[2], 0.6, 0.7, 0.04, 6, 2);
    }
    for (const p of this.portals) {
      const o = p.open, h = p.hover;
      const c = p.col;
      const call = this.fresh && p.id === 'odyssey' ? 0.25 + 0.25 * Math.sin(this.t * 3) : 0;
      D.ents.push(p.x, p.y, 74 + h * 10 + call * 12, 2, c[0], c[1], c[2], (0.4 + 0.6 * o) * (0.75 + 0.25 * h + call), 0.62, 0.03, 16, 5);
      D.ents.push(p.x, p.y, 54, 2, c[0], c[1], c[2], o * (0.5 + 0.5 * h), 0.5, 0.018, 26, -7);
      D.light(p.x, p.y, 60, 230, c[0], c[1], c[2], -(0.4 + 0.7 * h) * o);
      // label beneath the portal
      const [sx, sy] = G.worldToScreen(p.x, p.y + 92);
      p.el.style.left = sx + 'px'; p.el.style.top = sy + 'px';
      p.el.style.opacity = (o * (0.55 + 0.45 * h)).toFixed(2);
    }
  }

  camera(cam, dt) {
    const G = this.G;
    if (this.state === 'glass') { cam.tx = 0; cam.ty = 0; cam.tz = this.glassZoom(); return; }
    if (this.state === 'melt') { cam.tx = this.meltAt.x * 0.3; cam.ty = this.meltAt.y * 0.3; cam.tz = this.glassZoom() * (1 - Math.min(0.25, this.t * 0.08)); return; }
    const F = G.colony.focus;
    const z = this.hubZoom();
    cam.tz = z;
    if (F && F.alive) { cam.tx = F.B.cx * 0.35; cam.ty = F.B.cy * 0.35; }
  }
}
