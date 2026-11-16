// ─────────────────────────────────────────────────────────────────────────────
//  The Kneading Pool — no goal, no clock. Pull strands out of the creature with
//  the pointer, pour other fluids in, drop machines and neighbours, and watch
//  one physics answer everything.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { MAT } from '../sim/materials.js';
import { SPACING } from '../sim/physics.js';

const TOOLS = [
  { id: 'hand', g: '☟', name: 'knead · hold to pull the gel' },
  { id: 'light', g: '✦', name: 'light' }, { id: 'dew', g: '◌', name: 'dew' }, { id: 'oil', g: '●', name: 'oil', mat: MAT.OIL }, { id: 'silver', g: '◍', name: 'quicksilver', mat: MAT.SILVER },
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
      onReveal: () => { app.hud.showTitle('', 'The Kneading Pool', 'nothing to win'); app.hud.setCorner(true, () => app.pause()); this.tray(); },
    });
  }
  exit() { if (this.el) this.el.remove(); }
  tray() {
    if (this.el) this.el.remove();
    const el = this.el = document.createElement('div'); el.className = 'h-tray';
    el.innerHTML = TOOLS.map(t => `<button data-id="${t.id}" title="${t.name}" class="${t.id === this.tool ? 'on' : ''}">${t.g}</button>`).join('') + '<div class="tip"></div>';
    this.app.hud.root.appendChild(el);
    el.querySelectorAll('button').forEach(b => { b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.id; if (id === 'clear') { this.app.setMode(new Pool(this.app, { mass: 90 })); return; } this.tool = id; el.querySelectorAll('button').forEach(q => q.classList.toggle('on', q === b)); el.querySelector('.tip').textContent = TOOLS.find(t => t.id === id).name; }; });
    el.querySelector('.tip').textContent = TOOLS[0].name;
  }
  blob(W, x, y, n, mat) {
    const P = W.phys; const B = P.allocBody(-2 - ((Math.random() * 1e4) | 0) % 1 - (this._g = (this._g || 0) + 1), 'loose', mat); if (!B) return; let k = 0;
    for (let r = 0; k < n; r++) { const m = Math.max(1, Math.floor(6.28 * r)); for (let a = 0; a < m && k < n; a++) { const ang = a / m * 6.28; P.spawn(x + Math.cos(ang) * r * SPACING, y + Math.sin(ang) * r * SPACING, 0, 0, mat, B.id); k++; } }
  }
  place(wx, wy) {
    const W = this.app.world, R = this.app.R, t = this.tool; const add = (d) => { const e = W.spawn({ ...d, x: wx, y: wy }); if (e && e.bake) { R.room.decals.push(e); R.ink.target(true); e.bake(R.ink, R); R.ink.target(false); R.fb.invalidate(); } return e; };
    if (W.phys.sampleSDF(wx, wy) < 12) return;
    if (t === 'light') for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; W.spawn({ type: 'mote', x: wx + Math.cos(a) * 26, y: wy + Math.sin(a) * 26, free: true }); }
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
    return false;
  }
  // kneading: while the button is held, gel near the pointer is drawn to it — pull a strand, let it snap back
  update(dt, W) {
    const inp = this.app.input; if (this.tool !== 'hand' || !inp.mouse.down && !(inp.stick.active && inp.pointers.size > 1)) return;
    const a = this.app.ctl.aim; if (!a) return; const P = W.phys;
    P.forEachNear(a.x, a.y, 90, (i, dx, dy) => { const d = Math.sqrt(dx * dx + dy * dy) + 4; const f = 2600 * (1 - d / 94) * dt; P.vx[i] -= dx / d * f; P.vy[i] -= dy / d * f; P.glow[i] = Math.max(P.glow[i], 0.5); });
    W.fx.list.length < 60 && Math.random() < 0.3 && W.fx.add({ x: a.x, y: a.y, type: 2, size: 10, grow: 90, life: 0.35, col: [0.9, 0.85, 1], a: 0.35, w: 1.4, drag: 0 });
  }
  post(dt, W) { if (!W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 60); W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 120, 0.8); } }
}
