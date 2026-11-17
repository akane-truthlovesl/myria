// ─────────────────────────────────────────────────────────────────────────────
//  The Kneading Pool — no goal, no clock. Pull strands out of the creature with
//  the pointer, pour other fluids in, drop machines and neighbours, and watch
//  one physics answer everything.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { MAT } from '../sim/materials.js';
import { SPACING } from '../sim/physics.js';

import { shoalOf, fireflyCloud } from '../world/plankton.js';
const TOOLS = [
  { id: 'hand', g: '☟', name: 'knead · every finger holds the gel — pull, pinch, stretch' },
  { id: 'bubble', g: '◯', name: 'bubble · the gel swallows air and swells · dart to breathe out' }, { id: 'weight', g: '⇣', name: 'weight · give the pool a down (with motion on, tip the device to pour)', toggle: true },
  { id: 'light', g: '✦', name: 'light' }, { id: 'dew', g: '◌', name: 'dew' },
  { id: 'school', g: '⋙', name: 'a school · it swims as one — hold still and it comes to look' }, { id: 'fireflies', g: '✧', name: 'fireflies · each blinks alone, until they find one flash' },
  { id: 'shy', g: '✩', name: 'shy sparks · drift in slowly, or they bolt' }, { id: 'drift', g: '≈', name: 'drift · rides any current' }, { id: 'pod', g: '❦', name: 'seed pod · brush it and it bursts (it grows back)' }, { id: 'oil', g: '●', name: 'oil', mat: MAT.OIL }, { id: 'silver', g: '◍', name: 'quicksilver', mat: MAT.SILVER },
  { id: 'resin', g: '◉', name: 'resin', mat: MAT.RESIN }, { id: 'foam', g: '○', name: 'foam', mat: MAT.FOAM }, { id: 'iron', g: '✺', name: 'ferrofluid', mat: MAT.FERRO },
  { id: 'grazer', g: '☼', name: 'grazer' }, { id: 'hunter', g: '➶', name: 'lancer' }, { id: 'thorn', g: '✸', name: 'thornback' },
  { id: 'grinder', g: '⚙', name: 'grinder' }, { id: 'blade', g: '／', name: 'blade' }, { id: 'well', g: '◎', name: 'well' }, { id: 'pool', g: '♨', name: 'spring' }, { id: 'film', g: '⌇', name: 'film' },
  { id: 'magnet', g: '⊛', name: 'pulsing pole · iron answers it' }, { id: 'rotor', g: '◔', name: 'turning ring' }, { id: 'band', g: '⌒', name: 'sling band · throws what touches it' }, { id: 'geyser', g: '❂', name: 'geyser · breathes in, throws out' }, { id: 'mimic', g: '✣', name: 'mimic · not every light is light' }, { id: 'sponge', g: '❉', name: 'sponge · drinks what leans on it; strike it to wring it out' }, { id: 'current', g: '≋', name: 'current' }, { id: 'vent', g: '♁', name: 'warm vent' }, { id: 'frost', g: '❄', name: 'frost' },
  { id: 'b-iron', g: '⬡', name: 'bath · become iron', bath: MAT.FERRO }, { id: 'b-silver', g: '⬢', name: 'bath · become quicksilver', bath: MAT.SILVER }, { id: 'b-armour', g: '⬣', name: 'bath · become armour', bath: MAT.BASTION }, { id: 'b-foam', g: '◎', name: 'bath · become foam (every dart a jet)', bath: MAT.FOAM, morph: { speed: 1.1, tonus: 0.85, dart: 1, jet: 1 } }, { id: 'b-spore', g: '❋', name: 'bath · become spore (what you leave ripens)', bath: MAT.SPORE }, { id: 'b-rinse', g: '◇', name: 'rinse · be yourself', rinse: true },
  { id: 'clear', g: '⌫', name: 'clear the pool' },
];

export class Pool {
  constructor(app, o = {}) { this.app = app; this.tool = 'hand'; this.mass = Math.max(90, o.mass || 90); }
  enter() {
    const app = this.app;
    app.travel((aspect) => { const { W, H } = frame(aspect, 0.9e6); return { name: 'Pool', seed: 11, W, H, geo: dish(W, H, { r: Math.min(W, H) * 0.34 }), ents: [], spawn: { x: W / 2, y: H / 2, n: this.mass }, pal: { deep: [0.020, 0.012, 0.040], mid: [0.070, 0.045, 0.120], wall: [0.110, 0.080, 0.165], rim: [0.80, 0.70, 1.0] } }; }, null, {
      onDark: () => app.applyBudget(),
      onLoad: (W) => { W.massCosts = false; W.massCap = 400; },
      onReveal: () => { app.hud.showTitle('', 'The Kneading Pool', 'nothing to win'); app.hud.setCorner(true, () => app.pause()); app.sound.ambience('pool'); this.tray(); },
    });
  }
  exit() { if (this.el) this.el.remove(); this.app.input.tiltMute = false; this.app.input.hands = false; }
  tray() {
    if (this.el) this.el.remove();
    const el = this.el = document.createElement('div'); el.className = 'h-tray';
    el.innerHTML = '<div class="row">' + TOOLS.map(t => `<button data-id="${t.id}" title="${t.name}" class="${t.id === this.tool ? 'on' : ''}">${t.g}</button>`).join('') + '</div><div class="tip"></div>';
    { const row = el.querySelector('.row'); row.addEventListener('wheel', (e) => { row.scrollLeft += e.deltaY || e.deltaX; e.preventDefault(); }, { passive: false }); }
    this.app.hud.root.appendChild(el);
    el.querySelectorAll('button').forEach(b => { b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.id; if (id === 'clear') { this.app.setMode(new Pool(this.app, { mass: 90 })); return; } if (id === 'weight') { this.weight = !this.weight; this.app.input.tiltMute = this.weight; el.querySelector('.tip').textContent = this.weight ? TOOLS.find(t => t.id === id).name : 'weightless again'; } else { this.tool = id; el.querySelector('.tip').textContent = TOOLS.find(t => t.id === id).name; } el.querySelectorAll('button').forEach(q => q.classList.toggle('on', q.dataset.id === this.tool || q.dataset.id === 'weight' && !!this.weight)); }; });
    el.querySelector('.tip').textContent = TOOLS[0].name;
  }
  blob(W, x, y, n, mat) {
    const P = W.phys; const B = P.allocBody(-2 - ((Math.random() * 1e4) | 0) % 1 - (this._g = (this._g || 0) + 1), 'loose', mat); if (!B) return; let k = 0;
    for (let r = 0; k < n; r++) { const m = Math.max(1, Math.floor(6.28 * r)); for (let a = 0; a < m && k < n; a++) { const ang = a / m * 6.28; P.spawn(x + Math.cos(ang) * r * SPACING, y + Math.sin(ang) * r * SPACING, 0, 0, mat, B.id); k++; } }
  }
  place(wx, wy) {
    const W = this.app.world, R = this.app.R, t = this.tool; const add = (d) => { const e = W.spawn({ ...d, x: wx, y: wy }); if (e && e.bake) { R.room.decals.push(e); R.ink.target(true); e.bake(R.ink, R); R.ink.target(false); R.fb.invalidate(); } return e; };
    if (W.phys.sampleSDF(wx, wy) < 12) return;
    if (t === 'bubble') { for (let k = 0; k < 3; k++) W.spawn({ type: 'bubble', x: wx + (Math.random() - 0.5) * 30, y: wy + (Math.random() - 0.5) * 30, r: 13 + Math.random() * 15, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, safe: 0.25 }); this.app.sound.pop(0.4); return; }
    if (t === 'light') for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; W.spawn({ type: 'mote', x: wx + Math.cos(a) * 26, y: wy + Math.sin(a) * 26, free: true }); }
    else if (t === 'school') { this.nSchool = (this.nSchool || 0) + 1; for (const d of shoalOf('pool' + this.nSchool, wx, wy, 7, { range: 260 })) W.spawn(d); }
    else if (t === 'fireflies') { for (const d of fireflyCloud(wx, wy, 8, 64, { period: 2.4 })) W.spawn(d); }
    else if (t === 'shy') { for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28 + 0.5, x = wx + Math.cos(a) * 34, y = wy + Math.sin(a) * 34; if (W.phys.sampleSDF(x, y) > 10) { const m = W.spawn({ type: 'mote', kind: 'shy', x, y }); W.settle(m); } } }
    else if (t === 'drift') { for (let k = 0; k < 3; k++) W.spawn({ type: 'mote', kind: 'drift', x: wx + (k - 1) * 30, y: wy + (Math.random() - 0.5) * 20 }); }
    else if (t === 'pod') W.spawn({ type: 'pod', x: wx, y: wy, a: -Math.PI / 2, n: 6, regrow: 9 });
    else if (t === 'dew') { const P = W.phys; for (let k = 0; k < 10; k++) { const D = P.allocBody(-1, 'dew', MAT.DEW); if (D) P.spawn(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 0, 0, MAT.DEW, D.id); } }
    else if (['oil', 'silver', 'resin', 'foam', 'iron'].includes(t)) this.blob(W, wx, wy, 44, TOOLS.find(q => q.id === t).mat);
    else if (t === 'magnet') add({ type: 'magnet', reach: 210, power: 620, period: 4.2 }); else if (t === 'rotor') add({ type: 'rotor', R: 96, gap: 0.5, spin: Math.random() < 0.5 ? 0.5 : -0.5 });
    else if (t === 'current') { const a = Math.random() * 6.28; add({ type: 'current', w: 260, h: 110, vx: Math.cos(a) > 0 ? 220 : -220, vy: 0 }); }
    else if (t === 'band') { const sp = W.spec, dx = sp.W / 2 - wx, dy = sp.H / 2 - wy, d = Math.hypot(dx, dy) || 1, far = Math.max(d, 200); add({ type: 'bumper', len: 130, to: { x: wx + dx / d * far, y: wy + dy / d * far } }); }      // it throws toward the middle of the dish
    else if (t === 'sponge') add({ type: 'sponge' });
    else if (t === 'geyser') add({ type: 'geyser', gifts: 30 }); else if (t === 'mimic') add({ type: 'mimic' });
    else if (t === 'vent') add({ type: 'vent' }); else if (t === 'frost') add({ type: 'frost', r: 120, rate: 0.6 });
    else if (t.startsWith('b-')) { const q = TOOLS.find(z => z.id === t); add(q.rinse ? { type: 'pool', kind: 'rinse', r: 40 } : { type: 'pool', kind: 'morph', mat: q.bath, morph: q.morph || { speed: 1, tonus: 1, dart: 1 }, r: 44 }); }
    else if (['grazer', 'hunter', 'thorn'].includes(t)) W.addRival(t, wx, wy, t === 'grazer' ? 26 : 50);
    else if (t === 'grinder') add({ type: 'grinder', r: 40, spin: 2.6 }); else if (t === 'blade') add({ type: 'blade', len: 140, spin: 1.5 });
    else if (t === 'well') add({ type: 'well', r: 17, reach: 220 }); else if (t === 'pool') add({ type: 'pool', kind: 'heal', r: 50, max: 80 }); else if (t === 'film') add({ type: 'film', len: 170, a: Math.random() * 3.14 });
    W.fx.ring(wx, wy, [0.8, 0.9, 1], 50, 0.4); this.app.sound.pop(0.6);
  }
  onEvent(e) {
    if (this.app.state !== 'play' || this.app.paused) return false;
    if ((e.type === 'click' || e.type === 'tap') && this.tool !== 'hand') { const [wx, wy] = this.app.R.cssToWorld(e.x, e.y); this.place(wx, wy); return true; }
    if (e.type === 'click' && this.tool === 'hand') return true;       // in the pool a held click kneads instead of darting (Space still darts)
    if (this.tool === 'hand' && (e.type === 'tap' || e.type === 'budAt' || e.type === 'dartDir')) return true;      // …and fingers are hands here, not commands
    return false;
  }
  // Kneading: every finger on the glass (or the held mouse button) takes hold of the gel under it — the gel is drawn to the finger and carried with it,
  // so two fingers pull a strand between them, pinch it thin, fold it over. While hands are on it the creature has no will of its own.
  update(dt, W) {
    const app = this.app, inp = app.input, P = W.phys, R = app.R; inp.hands = this.tool === 'hand';
    // weight: the pool gets a "down" — straight down, or wherever the device says down is
    { let gx = 0, gy = 0; if (this.weight) { gy = 1; const T = inp.tilt; if (T.on && performance.now() - T.t < 900) { gx = T.x * 1.4; gy = T.y * 1.4; const m = Math.hypot(gx, gy); if (m > 1) { gx /= m; gy /= m; } } } const k = Math.min(1, dt * 4); P.gx += (gx * 520 - P.gx) * k; P.gy += (gy * 520 - P.gy) * k; if (Math.abs(P.gx) + Math.abs(P.gy) < 1) P.gx = P.gy = 0; }
    if (this.tool !== 'hand') return;
    const grabs = []; const now = performance.now(); let fingers = 0; const held = this.held || (this.held = new Map());
    for (const p of inp.pointers.values()) {
      if (!p.touch) continue; fingers++; const [wx, wy] = R.cssToWorld(p.x, p.y); const h = p.hist || [], a = h[h.length - 1], b = h[Math.max(0, h.length - 4)]; let vx = 0, vy = 0;
      if (a && b && a[2] > b[2] && now - a[2] < 90) { const k = R.pxScale / R.view.z * 1000 / (a[2] - b[2]); vx = (a[0] - b[0]) * k; vy = (a[1] - b[1]) * k; const m = Math.hypot(vx, vy); if (m > 900) { vx *= 900 / m; vy *= 900 / m; } }
      grabs.push([wx, wy, vx, vy, 't' + p.id]);
    }
    if (!fingers && inp.mouse.down) { const a = app.ctl.aim; if (a) { const q = this._pa; let vx = 0, vy = 0; if (q) { vx = (a.x - q[0]) / dt; vy = (a.y - q[1]) / dt; q[2] += (vx - q[2]) * 0.2; q[3] += (vy - q[3]) * 0.2; q[0] = a.x; q[1] = a.y; vx = q[2]; vy = q[3]; } else this._pa = [a.x, a.y, 0, 0]; grabs.push([a.x, a.y, vx, vy, 'm']); } } else this._pa = null;
    for (const id of [...held.keys()]) if (!grabs.some(g => g[4] === id)) held.delete(id);
    // let go of, whatever was pulled apart drifts back together by itself after a breath
    if (!grabs.length) { this.idleT = (this.idleT || 0) + dt; if (this.idleT > 1.1 && W.player.orgs.length > 1) W.callHome = 0.2; return; }
    this.idleT = 0; for (const O of W.player.orgs) O.knead = 1;
    for (const g of grabs) {
      // what was under the fingertip when it came down is stuck to it — a pinch of gel that goes wherever the finger goes…
      let H = held.get(g[4]);
      if (!H) { const near = []; P.forEachNear(g[0], g[1], 36, (i, dx, dy) => { near.push([dx * dx + dy * dy, i, dx, dy]); }); near.sort((a, b) => a[0] - b[0]); H = near.slice(0, 12).map(q => [q[1], q[2] * 0.6, q[3] * 0.6]); held.set(g[4], H); }      // (a pinch, not a fistful: what is not pinched is free to draw out into a strand)
      for (const q of H) { const i = q[0]; if (!P.alive[i]) continue; let vx = (g[0] + q[1] - P.x[i]) * 22 + g[2] * 0.5, vy = (g[1] + q[2] - P.y[i]) * 22 + g[3] * 0.5; const m = Math.hypot(vx, vy); if (m > 1500) { vx *= 1500 / m; vy *= 1500 / m; } P.vx[i] = vx; P.vy[i] = vy; P.ox[i] = P.x[i] - vx / 120; P.oy[i] = P.y[i] - vy / 120; P.glow[i] = Math.max(P.glow[i], 0.9); }
      // …and the gel around it is drawn in and dragged along, more and more loosely
      P.forEachNear(g[0], g[1], 96, (i, dx, dy) => { const d = Math.sqrt(dx * dx + dy * dy) + 4, w = 1 - d / 100; if (w <= 0) return; const f = 1300 * w * dt; P.vx[i] -= dx / d * f; P.vy[i] -= dy / d * f; const k = Math.min(1, w * dt * 5); P.vx[i] += (g[2] - P.vx[i]) * k; P.vy[i] += (g[3] - P.vy[i]) * k; P.glow[i] = Math.max(P.glow[i], 0.5); });
      W.fx.list.length < 60 && Math.random() < 0.3 && W.fx.add({ x: g[0], y: g[1], type: 2, size: 10, grow: 90, life: 0.35, col: [0.9, 0.85, 1], a: 0.35, w: 1.4, drag: 0 });
    }
    this.kneads = (this.kneads || 0) + grabs.length * dt;
  }
  post(dt, W) { if (!W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 60); W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 120, 0.8); } }
}
