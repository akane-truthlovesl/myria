// ─────────────────────────────────────────────────────────────────────────────
//  DUET — two creatures, one screen.
//  ◉ Lumen Rush (versus): drink the most light in 90 s. Slam your rival to
//    shear glowing mass off them — then race to drink it. A hungry singularity
//    sits at the heart of the dish, ringed with the richest light.
//  ◉ Twin Hearts (together): two pads, far apart, must be held at once to
//    bloom the heart. A slow blade sweeps the dish. Split yourself if you dare.
// ─────────────────────────────────────────────────────────────────────────────
import { AREA_PER_P } from '../engine/physics.js';
import { MAT, SURF } from '../engine/materials.js';
import { sound } from '../audio/audio.js';
import { save } from '../game/save.js';
import { DuetInput } from '../game/duet_input.js';
import { patchSplit, unpatchSplit } from '../game/pool_patch.js';

const TAU = Math.PI * 2;
const ROUND = 90;
const TEAL = { absorb: [0.66, 0.16, 0.05], emit: [0.42, 0.95, 1.0], metal: 0 };
const COL = [[1.0, 0.62, 0.48], [0.42, 0.95, 1.0]];
const CSSCOL = ['#ffb08f', '#7ff0ff'];
const NAMES = ['coral', 'tide'];

const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* ignore */ } };

const PILLARS = [0, 1, 2, 3, 4, 5].map(k => { const a = (30 + 60 * k) * Math.PI / 180; return [Math.cos(a) * 470, Math.sin(a) * 470]; });

const ARENA = {
  id: 'duet', bounds: [-900, -900, 900, 900], view: 1800, gravity: [0, 0], drag: 0.3, cap: 900,
  palette: { p0: [0.008, 0.004, 0.016], p1: [0.034, 0.012, 0.046], p2: [0.10, 0.055, 0.105], p3: [1.0, 0.72, 0.9], sky: [0.9, 0.72, 0.92], grid: 0.9, bright: 1 },
  geo: [
    { op: 'carve', t: 'circle', x: 0, y: 0, r: 820 },
    ...PILLARS.map(([x, y]) => ({ op: 'add', t: 'circle', x, y, r: 44, mat: SURF.GLASS })),
  ],
  entities: [],
};

const CSS = `
.du-hud{position:absolute;left:0;right:0;top:max(12px,env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:flex-start;padding:0 64px 0 18px;pointer-events:none;transition:opacity .6s}
.du-hud.off{opacity:0}
.du-sc{display:flex;align-items:center;gap:9px;font-size:22px;font-weight:300;letter-spacing:.06em;font-variant-numeric:tabular-nums;min-width:120px}
.du-sc i{width:12px;height:12px;border-radius:50%;box-shadow:0 0 14px 3px currentColor;background:currentColor}
.du-sc small{font-size:10px;letter-spacing:.3em;opacity:.55;text-transform:uppercase}
.du-sc.r{justify-content:flex-end}
.du-sc.lead b{text-shadow:0 0 16px currentColor}
.du-mid{text-align:center}
.du-time{font-size:20px;font-weight:300;letter-spacing:.14em;font-variant-numeric:tabular-nums;color:#f3eef6}
.du-time.hot{color:#ffb3a0;text-shadow:0 0 14px rgba(255,140,110,.7)}
.du-sub{font-size:9.5px;letter-spacing:.38em;text-indent:.38em;text-transform:uppercase;color:rgba(240,225,245,.5);margin-top:3px}
.du-count{position:absolute;left:0;right:0;top:36%;text-align:center;font-size:clamp(54px,9vw,110px);font-weight:200;letter-spacing:.1em;color:#fff4f8;text-shadow:0 0 40px rgba(255,190,220,.55);opacity:0;pointer-events:none}
.du-count.pulse{animation:dupulse .9s ease-out forwards}
@keyframes dupulse{0%{opacity:0;transform:scale(1.35)}18%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.88)}}
.du-pick{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:12px 0 4px}
.du-opt{width:min(220px,40vw);padding:14px 12px;border-radius:16px;border:1px solid rgba(255,200,230,.16);background:rgba(255,190,230,.04);text-align:center;cursor:pointer;transition:background .2s,border-color .2s,transform .15s}
.du-opt:hover{background:rgba(255,190,230,.1);border-color:rgba(255,200,230,.4)}
.du-opt.sel{border-color:rgba(255,215,190,.7);box-shadow:0 0 22px rgba(255,180,160,.2)}
.du-opt b{display:block;font-weight:400;letter-spacing:.3em;text-transform:uppercase;font-size:13px;margin-bottom:6px}
.du-opt span{font-size:11px;letter-spacing:.06em;color:rgba(235,220,240,.62);line-height:1.5}
.du-legend{display:flex;justify-content:space-between;gap:16px;margin:16px 0 4px;font-size:11px;color:rgba(235,225,245,.7)}
.du-legend>div{flex:1;display:flex;flex-direction:column;gap:6px;align-items:center}
.du-legend .who{letter-spacing:.32em;text-transform:uppercase;font-size:10px}
.du-k{display:inline-block;min-width:18px;padding:2px 6px;margin:0 1px;border:1px solid rgba(255,235,250,.35);border-radius:5px;font-size:10.5px;background:rgba(30,15,35,.35)}
.du-legend .row{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
.du-legend .lab{opacity:.55;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase}
.du-thumb{width:30px;height:30px;border-radius:50%;border:1.5px solid currentColor;box-shadow:0 0 14px currentColor;opacity:.8}
.du-win{font-size:28px;font-weight:300;letter-spacing:.3em;text-indent:.3em;text-transform:uppercase;margin:4px 0 14px}
.du-bars{display:flex;flex-direction:column;gap:8px;margin:6px auto 12px;max-width:360px}
.du-bar{display:flex;align-items:center;gap:10px;font-size:12px;letter-spacing:.1em}
.du-bar .tr{flex:1;height:8px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden}
.du-bar .fl{height:100%;border-radius:5px;transition:width 1.2s cubic-bezier(.2,.8,.2,1)}
.du-bar b{min-width:44px;text-align:right;font-weight:500;font-variant-numeric:tabular-nums}
`;

// a pad that blooms when enough light rests on it (co-op)
class Pad {
  constructor(x, y, need, hue) { this.x = x; this.y = y; this.r = 74; this.need = need; this.count = 0; this.fill = 0; this.hue = hue; this.t = Math.random() * 5; this.born = 0; }
}

export class Mode {
  constructor(G, app, opts = {}) { this.G = G; this.app = app; this.game = opts.game || 'rush'; }

  enter() {
    const G = this.G;
    G.input.enabled = true;
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    this.hudEl = document.createElement('div'); this.hudEl.className = 'du-hud off';
    this.hudEl.innerHTML = `<div class="du-sc l" style="color:${CSSCOL[0]}"><i></i><b>0</b><small>${NAMES[0]}</small></div>
      <div class="du-mid"><div class="du-time">1:30</div><div class="du-sub"></div></div>
      <div class="du-sc r" style="color:${CSSCOL[1]}"><small>${NAMES[1]}</small><b>0</b><i></i></div>`;
    G.hud.root.appendChild(this.hudEl);
    this.countEl = document.createElement('div'); this.countEl.className = 'du-count'; G.hud.root.appendChild(this.countEl);
    this.sc = [this.hudEl.querySelector('.l b'), this.hudEl.querySelector('.r b')];
    this.scBox = [this.hudEl.querySelector('.l'), this.hudEl.querySelector('.r')];
    this.timeEl = this.hudEl.querySelector('.du-time'); this.subEl = this.hudEl.querySelector('.du-sub');
    this.din = new DuetInput(G);
    patchSplit(G);
    G.hud.setCorner(true, () => this.pause());
    G.hud.hideCounter();
    this.setup();
    this.choose();
  }

  exit() {
    const G = this.G;
    this.hudEl.remove(); this.countEl.remove(); this.style.remove();
    G.onMote = null; G.dartCost = null; G.massCap = 520; G.speedScale = 1;
    unpatchSplit(G);
  }

  // ── world ─────────────────────────────────────────────────────────────
  setup() {
    const G = this.G;
    G.load(ARENA);
    G.massCap = 900; G.speedScale = 1.06;
    G.dartCost = (O) => Math.max(1, Math.round(O.B.count * 0.022));
    this.C = [
      G.addColony(0, -440, 0, 140, {}),
      G.addColony(1, 440, 0, 140, { layer: 1, tint: TEAL }),
    ];
    G.colony = this.C[0];
    this.home = [[-440, 0], [440, 0]];
    this.stats = [0, 1].map(() => ({ motes: 0, slams: 0, stolen: 0, lost: 0, peak: 140, darts: 0 }));
    this.motes = [];
    this.pads = []; this.hearts = 0; this.bloomT = 0; this.padHold = 0; this.need = 46;
    this.singularity = null; this.blade = null;
    this.slamCD = 0; this.moteT = 0; this.goldT = 9; this.cometT = 14;
    this.time = ROUND; this.state = 'idle'; this.t = 0;
    G.onMote = (m, B) => { const k = B.group; if (k === 0 || k === 1) { this.stats[k].motes++; if (m.gold) { G.hud.toast(`${NAMES[k]} · golden light`, '✦'); } } };
    G.cam.snap(0, 0, this.zoomFit());
  }

  arm() {
    // per-game contraptions
    const G = this.G;
    for (const e of G.ents) if (e.kind === 'duet') { e.dead = true; }
    G.phys.zones.length = 0;
    G.phys.shapes = G.phys.shapes.filter(s => !s._duet);
    if (this.game === 'rush') {
      this.singularity = G.spawnEntity({ type: 'singularity', x: 0, y: 0, r: 20, strength: 64000, reach: 340, swirl: 9000 });
      this.singularity.kind = 'duet';
      sound.setKey(55, 'dorian'); sound.ambience('tense', 55);
    } else {
      this.blade = G.spawnEntity({ type: 'blade', x: 0, y: 0, len: 760, spin: 0.42 });
      this.blade.kind = 'duet'; this.blade.S._duet = true;
      sound.setKey(57, 'lydian'); sound.ambience('bright', 57);
      this.spawnPads();
    }
    this.subEl.textContent = this.game === 'rush' ? 'lumen rush' : 'twin hearts';
  }

  // ── flow: choose → count → play → end ─────────────────────────────────
  choose() {
    const G = this.G;
    this.state = 'choose'; this.hudEl.classList.add('off');
    const touchy = matchMedia('(pointer: coarse)').matches;
    const k = (s) => `<span class="du-k">${s}</span>`;
    const legend = touchy
      ? `<div class="du-legend"><div style="color:${CSSCOL[0]}"><span class="who">${NAMES[0]}</span><div class="du-thumb"></div><span class="lab">left half · drag · flick</span></div>
         <div style="color:${CSSCOL[1]}"><span class="who">${NAMES[1]}</span><div class="du-thumb"></div><span class="lab">right half · drag · flick</span></div></div>`
      : `<div class="du-legend"><div style="color:${CSSCOL[0]}"><span class="who">${NAMES[0]}</span><div class="row">${k('W')}${k('A')}${k('S')}${k('D')}</div><div class="row">${k('Space')}<span class="lab">dart</span>${k('E')}<span class="lab">bud</span>${k('Q')}<span class="lab">rally</span></div></div>
         <div style="color:${CSSCOL[1]}"><span class="who">${NAMES[1]}</span><div class="row">${k('↑')}${k('←')}${k('↓')}${k('→')}</div><div class="row">${k('Enter')}<span class="lab">dart</span>${k('/')}<span class="lab">bud</span>${k('Ctrl')}<span class="lab">rally</span></div></div></div>`;
    const best = save.get('duet.hearts.best', 0);
    G.hud.showCard(`
      <div class="c-head">duet</div>
      <div class="du-pick">
        <div class="du-opt ${this.game === 'rush' ? 'sel' : ''}" data-g="rush"><b>Lumen Rush</b><span>versus · drink the most light.<br>slam to shear your rival's glow.</span></div>
        <div class="du-opt ${this.game === 'hearts' ? 'sel' : ''}" data-g="hearts"><b>Twin Hearts</b><span>together · hold both pads at once.<br>${best ? `best: ${best} hearts` : 'mind the sweeping blade.'}</span></div>
      </div>
      ${legend}`, [
      { label: 'Begin', cls: 'primary', fn: () => { G.hud.hideCard(); this.countdown(); } },
      { label: 'Atrium', fn: () => { G.hud.hideCard(); this.app.hub(); } },
    ]);
    G.hud.card.querySelectorAll('.du-opt').forEach(o => o.onclick = (e) => {
      e.stopPropagation(); this.game = o.dataset.g; sound.ui();
      G.hud.card.querySelectorAll('.du-opt').forEach(x => x.classList.toggle('sel', x === o));
    });
  }

  countdown() {
    const G = this.G;
    this.resetRound();
    this.arm();
    this.state = 'count'; this.t = 0; this.cn = 4;
    this.hudEl.classList.remove('off');
    G.hud.showTitle(this.game === 'rush' ? 'Lumen Rush' : 'Twin Hearts', this.game === 'rush' ? 'versus' : 'together', 2.2);
  }

  resetRound() {
    const G = this.G, P = G.phys;
    // clear loose matter and motes, re-seat both creatures
    for (const m of this.motes) m.dead = true;
    this.motes = [];
    for (const e of G.ents) if (e.kind === 'duet') e.dead = true;
    for (let k = 0; k < 2; k++) {
      const C = this.C[k];
      for (const O of C.orgs) for (let q = 0; q < O.B.len; q++) P.kill(P.bodyIdx[O.B.start + q]);
      C.orgs = []; C.focus = null;
      C.spawn(this.home[k][0], this.home[k][1], 140);
    }
    for (let i = 0; i < P.hi; i++) if (P.alive[i]) { const B = P.bodies[P.body[i]]; if (B.group !== 0 && B.group !== 1) P.kill(i); }
    this.stats = [0, 1].map(() => ({ motes: 0, slams: 0, stolen: 0, lost: 0, peak: 140, darts: 0 }));
    this.pads = []; this.hearts = 0; this.padHold = 0; this.need = 46; this.time = ROUND;
    this.moteT = 0; this.goldT = 9; this.cometT = 14;
    this.din.clear();
  }

  finish() {
    const G = this.G;
    this.state = 'end'; this.t = 0;
    const m = [this.C[0].mass, this.C[1].mass];
    sound.portal();
    let html;
    if (this.game === 'rush') {
      const w = m[0] === m[1] ? -1 : m[0] > m[1] ? 0 : 1;
      if (w >= 0) {
        const W = this.C[w].focus;
        if (W) { W.B.energy = 1.2; G.fx.ring(W.B.cx, W.B.cy, COL[w], 360, 1.4); for (let k = 0; k < 50; k++) { const a = Math.random() * TAU, s = 120 + Math.random() * 380; G.fx.add({ x: W.B.cx, y: W.B.cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random(), size: 3 + Math.random() * 4, type: Math.random() < 0.3 ? 3 : 0, r: COL[w][0], g: COL[w][1], b: COL[w][2], a: 1, drag: 1.4 }); } }
      }
      const mx = Math.max(1, m[0], m[1]);
      const bar = (k) => `<div class="du-bar" style="color:${CSSCOL[k]}"><span style="min-width:44px;text-transform:uppercase;letter-spacing:.24em;font-size:10px">${NAMES[k]}</span><div class="tr"><div class="fl" style="width:0;background:${CSSCOL[k]};box-shadow:0 0 12px ${CSSCOL[k]}" data-w="${(m[k] / mx * 100).toFixed(1)}"></div></div><b>${m[k]}</b></div>`;
      const st = this.stats;
      html = `<div class="c-head">lumen rush</div>
        <div class="du-win" style="color:${w >= 0 ? CSSCOL[w] : '#fff'}">${w >= 0 ? `${NAMES[w]} blooms` : 'perfect harmony'}</div>
        <div class="du-bars">${bar(0)}${bar(1)}</div>
        <div class="stats">
          <span>light drunk <b>${st[0].motes} · ${st[1].motes}</b></span><span>slams <b>${st[0].slams} · ${st[1].slams}</b></span>
          <span>glow stolen <b>${st[0].stolen} · ${st[1].stolen}</b></span><span>peak <b>${st[0].peak} · ${st[1].peak}</b></span>
        </div>`;
    } else {
      const best = Math.max(save.get('duet.hearts.best', 0), this.hearts);
      const isBest = this.hearts > save.get('duet.hearts.best', 0) && this.hearts > 0;
      save.set('duet.hearts.best', best);
      for (const C of this.C) if (C.focus) { C.focus.B.energy = 1; G.fx.ring(C.focus.B.cx, C.focus.B.cy, [1, 0.8, 0.9], 260, 1.2); }
      html = `<div class="c-head">twin hearts</div>
        <div class="du-win" style="color:#ffd6e6">${this.hearts} ${this.hearts === 1 ? 'heart' : 'hearts'} bloomed</div>
        <div class="stats">
          <span>light drunk <b>${this.stats[0].motes + this.stats[1].motes}</b></span><span>best together <b>${best}</b></span>
          <span>${NAMES[0]} mass <b>${m[0]}</b></span><span>${NAMES[1]} mass <b>${m[1]}</b></span>
        </div>${isBest ? '<div class="c-head" style="margin-top:10px;color:#ffd0e0">a new best together</div>' : ''}`;
    }
    setTimeout(() => {
      if (this.state !== 'end') return;
      G.hud.showCard(html, [
        { label: 'Rematch', cls: 'primary', fn: () => { G.hud.hideCard(); this.countdown(); } },
        { label: this.game === 'rush' ? 'Play together' : 'Play versus', fn: () => { G.hud.hideCard(); this.game = this.game === 'rush' ? 'hearts' : 'rush'; this.countdown(); } },
        { label: 'Atrium', fn: () => { G.hud.hideCard(); this.app.hub(); } },
      ]);
      requestAnimationFrame(() => G.hud.card.querySelectorAll('.fl').forEach(f => f.style.width = f.dataset.w + '%'));
    }, 1300);
  }

  pause() {
    const G = this.G;
    if (G.hud.menuOpen) { G.hud.closeMenu(); G.paused = false; return; }
    if (this.state === 'choose' || this.state === 'end') return;
    G.paused = true; sound.ui();
    G.hud.openMenu('Duet', [
      { label: 'Resume', cls: 'primary', fn: () => { G.hud.closeMenu(); G.paused = false; } },
      { label: 'Restart round', fn: () => { G.hud.closeMenu(); G.paused = false; this.countdown(); } },
      { label: 'Choose game', fn: () => { G.hud.closeMenu(); G.paused = false; this.resetRound(); this.choose(); } },
      { label: sound.muted ? 'Sound: off' : 'Sound: on', fn: () => { sound.setMuted(!sound.muted); G.hud.closeMenu(); G.paused = false; this.pause(); } },
      { label: 'Atrium', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.hub(); } },
    ], this.game === 'rush' ? 'lumen rush' : 'twin hearts');
  }

  // ── input ─────────────────────────────────────────────────────────────
  events(evs) {
    const G = this.G;
    for (const e of evs) {
      if (e.type === 'pause') { this.pause(); continue; }
      if (e.type === 'key') {
        this.din.key(e.code);
        if (this.state === 'choose' && (e.code === 'Enter' || e.code === 'Space')) { G.hud.hideCard(); this.countdown(); }
      }
    }
    // the default single-player stick must not draw or steer
    G.input.stick.active = false;
  }

  act(k, a) {
    const G = this.G, C = this.C[k], F = C.focus;
    if (a.type === 'pause') { this.pause(); return; }
    if (!F || !F.alive) return;
    const fac = this.din.pl[k].facing;
    if (a.type === 'dart') {
      let dx = a.x, dy = a.y;
      if (dx === undefined) { const m = this.din.pl[k].move; if (Math.hypot(m.x, m.y) > 0.2) { dx = m.x; dy = m.y; } else { dx = fac.x; dy = fac.y; } }
      if (F.dart(dx, dy, a.power || 1)) this.stats[k].darts++;
    } else if (a.type === 'bud') {
      let tx, ty;
      if (a.sx !== undefined) [tx, ty] = G.screenToWorld(a.sx, a.sy);
      else { tx = F.B.cx + fac.x * 200; ty = F.B.cy + fac.y * 200; }
      F.bud(tx, ty, 0.35);
    } else if (a.type === 'cycle') C.cycle(1);
  }

  // ── spawning light ────────────────────────────────────────────────────
  freeSpot(rmin, rmax) {
    const P = this.G.phys;
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * TAU, r = rmin + Math.random() * (rmax - rmin);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (P.sampleSDF(x, y) < 40) continue;
      let ok = true;
      for (const C of this.C) if (C.focus && C.focus.alive && Math.hypot(C.focus.B.cx - x, C.focus.B.cy - y) < C.focus.B.r + 90) ok = false;
      if (ok) return [x, y];
    }
    return null;
  }
  addMote(x, y, value = 3, gold = false) {
    const G = this.G;
    const m = G.spawnEntity({ type: 'mote', x, y, value, free: true, col: gold ? [1.0, 0.82, 0.32] : undefined });
    if (!m) return;
    m.kind = 'duet'; m.gold = gold;
    if (gold) m.r = 18;
    this.motes.push(m);
    G.fx.add({ x, y, life: 0.5, size: 4, grow: 50, type: 4, r: 1, g: 0.9, b: 0.7, a: 0.5, drag: 0 });
  }
  spawnLight(dt) {
    this.motes = this.motes.filter(m => !m.dead);
    this.moteT -= dt;
    const target = this.game === 'rush' ? 28 : 14;
    if (this.moteT <= 0 && this.motes.length < target) {
      this.moteT = this.game === 'rush' ? 0.32 : 0.7;
      const inner = this.game === 'rush' && Math.random() < 0.45;
      const s = inner ? this.freeSpot(110, 330) : this.freeSpot(340, 760);
      if (s) this.addMote(s[0], s[1], inner ? 4 : 3);
    }
    if (this.game !== 'rush') return;
    this.goldT -= dt;
    if (this.goldT <= 0) { this.goldT = 15; const s = this.freeSpot(150, 420); if (s) { this.addMote(s[0], s[1], 10, true); sound.prism(); } }
    this.cometT -= dt;
    if (this.cometT <= 0) {
      this.cometT = 11 + Math.random() * 6;
      // a comet: an arc of light sweeping around the dish
      const a0 = Math.random() * TAU, r = 560 + Math.random() * 140, dir = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k < 8; k++) { const a = a0 + dir * k * 0.11; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (this.G.phys.sampleSDF(x, y) > 30) this.addMote(x, y, 3); }
      sound.bloom();
    }
  }

  spawnPads() {
    const a0 = Math.random() * TAU;
    const a1 = a0 + Math.PI * (0.7 + Math.random() * 0.6);
    const r0 = 600 + Math.random() * 90, r1 = 600 + Math.random() * 90;
    this.pads = [new Pad(Math.cos(a0) * r0, Math.sin(a0) * r0, this.need, 0), new Pad(Math.cos(a1) * r1, Math.sin(a1) * r1, this.need, 1)];
    for (const p of this.pads) this.G.fx.ring(p.x, p.y, [1, 0.8, 0.9], 160, 0.8);
    sound.open();
  }

  // ── frame ─────────────────────────────────────────────────────────────
  update(dt) {
    const G = this.G;
    this.t += dt;
    this.din.poll(dt);
    const live = this.state === 'play' || this.state === 'count' || this.state === 'choose';
    for (let k = 0; k < 2; k++) {
      const acts = this.din.take(k);
      if (live) for (const a of acts) this.act(k, a);
      const pl = this.din.pl[k];
      const mv = live ? pl.move : { x: 0, y: 0 };
      this.C[k].update(dt, mv, live && pl.rally);
      // the creature notices its own player's thumb
      const F = this.C[k].focus;
      if (pl.stick && F && F.alive) { const [wx, wy] = G.screenToWorld(pl.stick.ref.x, pl.stick.ref.y); F.touchTarget = { x: wx, y: wy }; }
      // survival floor: never eliminated
      if (this.C[k].mass < 14 || !this.C[k].focus) this.rebirth(k);
    }
    if (this.state === 'count') {
      const n = Math.ceil(3 - (this.t - 0.6));
      if (this.t > 0.6 && n !== this.cn && n >= 0) {
        this.cn = n;
        this.countEl.textContent = n > 0 ? String(n) : 'bloom';
        this.countEl.classList.remove('pulse'); void this.countEl.offsetWidth; this.countEl.classList.add('pulse');
        if (n > 0) sound.bell(sound.note(n === 3 ? 0 : n === 2 ? 2 : 4, 1), 0.35, 1.2, 0.8, 0.6); else { sound.bloom(); buzz(20); }
      }
      if (this.t > 3.6) { this.state = 'play'; this.t = 0; }
    }
    if (this.state === 'play') {
      this.time -= dt;
      this.spawnLight(dt);
      if (this.game === 'hearts') this.updatePads(dt);
      if (this.time <= 0) { this.time = 0; this.finish(); }
    }
    // hud
    const m0 = this.C[0].mass, m1 = this.C[1].mass;
    this.sc[0].textContent = this.game === 'rush' || this.state !== 'play' ? m0 : m0;
    this.sc[1].textContent = m1;
    this.scBox[0].classList.toggle('lead', this.game === 'rush' && m0 > m1 + 4);
    this.scBox[1].classList.toggle('lead', this.game === 'rush' && m1 > m0 + 4);
    for (let k = 0; k < 2; k++) this.stats[k].peak = Math.max(this.stats[k].peak, this.C[k].mass);
    const tt = Math.max(0, Math.ceil(this.time));
    this.timeEl.textContent = this.game === 'hearts' && this.state === 'play' ? `♥ ${this.hearts} · ${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}` : `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`;
    this.timeEl.classList.toggle('hot', this.state === 'play' && this.time < 10);
    if (this.state === 'play' && this.time < 10 && Math.ceil(this.time) !== this._tick) { this._tick = Math.ceil(this.time); sound.pluck(sound.note(7, 1), 0.2, 0.3, 0.3); }
  }

  rebirth(k) {
    const G = this.G, P = G.phys, C = this.C[k];
    for (const O of C.orgs) for (let q = 0; q < O.B.len; q++) P.kill(P.bodyIdx[O.B.start + q]);
    C.orgs = []; C.focus = null;
    const [x, y] = this.home[k];
    C.spawn(x, y, 60);
    G.fx.ring(x, y, COL[k], 180, 0.9);
    sound.bloom();
  }

  updatePads(dt) {
    const G = this.G, P = G.phys;
    if (this.bloomT > 0) { this.bloomT -= dt; if (this.bloomT <= 0) this.spawnPads(); return; }
    let full = 0;
    for (const p of this.pads) {
      p.t += dt; p.born = Math.min(1, p.born + dt * 1.5);
      let n = 0;
      P.forEachNear(p.x, p.y, p.r, (i) => { const B = P.bodies[P.body[i]]; if (B.group === 0 || B.group === 1) n++; });
      p.count = n;
      const f = Math.min(1, n / p.need);
      if (f >= 1 && p.fill < 1) { sound.plate(true); G.fx.ring(p.x, p.y, [1, 0.85, 0.9], 120, 0.5); }
      p.fill += (f - p.fill) * Math.min(1, dt * 7);
      if (f >= 1) full++;
      // a gentle cradle so settling on a pad is effortless
      for (const C of this.C) {
        const F = C.focus; if (!F || !F.alive) continue;
        const dx = p.x - F.B.cx, dy = p.y - F.B.cy; const d = Math.hypot(dx, dy);
        if (d < p.r * 1.3 && Math.hypot(F.intent.x, F.intent.y) < 0.25) F.cradle = { ax: dx * 4, ay: dy * 4, damp: 2 };
      }
    }
    if (full === 2) {
      this.padHold += dt;
      if (this.padHold > 0.5) this.bloom();
    } else this.padHold = Math.max(0, this.padHold - dt * 2);
  }

  bloom() {
    const G = this.G;
    this.hearts++; this.padHold = 0; this.bloomT = 1.4; this.need += 14;
    sound.bloom(); sound.trick(); buzz([10, 30, 10]);
    G.fx.ring(0, 0, [1, 0.7, 0.85], 520, 1.4);
    G.R.post.flash = [1, 0.75, 0.85, 0.12];
    for (const p of this.pads) {
      G.fx.ring(p.x, p.y, [1, 0.85, 0.9], 220, 0.9);
      for (let k = 0; k < 7; k++) { const a = Math.random() * TAU, r = 80 + Math.random() * 80; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (G.phys.sampleSDF(x, y) > 30) this.addMote(x, y, 3); }
    }
    this.time = Math.min(ROUND, this.time + 6);
    G.hud.toast(`heart ${this.hearts} · +6s`, '♥', 'cool');
    this.pads = [];
  }

  // ── after physics: slams, stealing ────────────────────────────────────
  post(dt) {
    const G = this.G, P = G.phys;
    this.slamCD = Math.max(0, this.slamCD - dt);
    if (this.state !== 'play' || this.game !== 'rush' || this.slamCD > 0) return;
    const n = P.ncontacts;
    let best = null, bestClose = 0;
    for (let k = 0; k < n; k++) {
      const i = P.contactA[k], j = P.contactB[k];
      if (!P.alive[i] || !P.alive[j]) continue;
      const Bi = P.bodies[P.body[i]], Bj = P.bodies[P.body[j]];
      if (!((Bi.group === 0 && Bj.group === 1) || (Bi.group === 1 && Bj.group === 0))) continue;
      let dx = Bj.cx - Bi.cx, dy = Bj.cy - Bi.cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const vi = Bi.vx * dx + Bi.vy * dy, vj = -(Bj.vx * dx + Bj.vy * dy);
      const close = vi + vj;
      if (close > bestClose) { bestClose = close; best = { i, j, Bi, Bj, vi, vj }; }
    }
    if (!best || bestClose < 330) return;
    const { i, j, Bi, Bj, vi, vj } = best;
    const cx = (P.x[i] + P.x[j]) / 2, cy = (P.y[i] + P.y[j]) / 2;
    if (Math.abs(vi - vj) < 90) {
      // head-on: both splash light everywhere — a mutual crash
      this.shear(Bi, Bj, Math.max(2, Math.round((bestClose - 250) / 110)), cx, cy, true);
      this.shear(Bj, Bi, Math.max(2, Math.round((bestClose - 250) / 110)), cx, cy, true);
      this.slamCD = 0.35; sound.splat(1); sound.boom(); buzz([12, 20, 12]); G.shakeAt(cx, cy, 0.8);
      G.fx.ring(cx, cy, [1, 0.9, 0.95], 150, 0.5);
      G.hud.toast('crash', '✸');
      return;
    }
    const att = vi >= vj ? Bi : Bj, vic = att === Bi ? Bj : Bi;
    this.shear(vic, att, Math.max(2, Math.min(14, Math.round((bestClose - 250) / 55 * Math.sqrt(vic.count / 140)))), cx, cy, false);
  }

  shear(vic, att, k, cx, cy, mutual) {
    const G = this.G, P = G.phys;
    const cand = [];
    for (let q = 0; q < vic.len; q++) { const p = P.bodyIdx[vic.start + q]; if (!P.alive[p] || P.body[p] !== vic.id) continue; const e = (P.x[p] - cx) ** 2 + (P.y[p] - cy) ** 2; cand.push([e, p]); }
    cand.sort((a, b) => a[0] - b[0]);
    const shed = Math.min(k, Math.max(0, cand.length - 10));
    const col = COL[vic.group];
    for (let q = 0; q < shed; q++) {
      const p = cand[q][1];
      G.shed(p, att.cx, att.cy, col, 5.5);
      const D = P.bodies[P.body[p]]; if (D) D.layer = vic.layer ?? (vic.group === 1 ? 1 : 0);
    }
    const ag = att.group, vg = vic.group;
    this.stats[vg].lost += shed;
    if (vic.ctrl) vic.ctrl.excite = 1;
    if (mutual) return;
    this.stats[ag].slams++;
    this.slamCD = 0.35;
    sound.splat(1); sound.hurt(0.8); buzz(18);
    G.shakeAt(cx, cy, 0.6);
    G.fx.ring(cx, cy, COL[ag], 120, 0.45);
    G.fx.sparks(cx, cy, 14, (vic.cx - att.cx), (vic.cy - att.cy), col, 420);
    if (shed >= 6) G.hud.toast(`${NAMES[ag]} · slam`, '✸', ag === 1 ? 'cool' : '');
    // victims flash
    if (vic.ctrl) vic.ctrl.excite = 1;
  }

  onMerge(keep, gone, n) {
    // count stolen glow: dew of the rival's colour drunk by the other
    if (this.game !== 'rush' || this.state !== 'play') return;
    if (gone.kind === 'dew' && gone.tint !== keep.tint && (keep.group === 0 || keep.group === 1)) this.stats[keep.group].stolen += n;
  }

  // ── visuals ───────────────────────────────────────────────────────────
  draw(D) {
    const G = this.G, z = G.cam.zoom;
    // each player's floating stick in their colour
    for (let k = 0; k < 2; k++) {
      const pl = this.din.pl[k]; if (!pl.stick) continue;
      const T = pl.stick, c = COL[k];
      const [ax, ay] = G.screenToWorld(T.ax, T.ay), [kx, ky] = G.screenToWorld(T.ref.x, T.ref.y);
      const rad = this.din.stickRadius / z;
      D.fxTop.push(ax, ay, rad, 4, c[0], c[1], c[2], 0.25, 3, 0, 0, 0);
      D.fxTop.push(kx, ky, rad * 0.42, 5, c[0], c[1], c[2], 0.35, 3, 0, 0, 0);
    }
    // pads (co-op)
    for (const p of this.pads) {
      const c = p.fill >= 0.99 ? [1, 0.85, 0.95] : [1, 0.6, 0.78];
      const pulse = 0.85 + 0.15 * Math.sin(p.t * 3);
      D.ents.push(p.x, p.y, p.r * 1.35 * p.born, 2, c[0], c[1], c[2], (0.45 + 0.55 * p.fill) * pulse, 0.7, 0.03, 12, 4);
      D.ents.push(p.x, p.y, p.r * p.born, 3, c[0], c[1], c[2], 0.12 + 0.35 * p.fill, p.t, 0, 0, 0);
      D.light(p.x, p.y, 50, 240, c[0], c[1], c[2], -(0.3 + 0.9 * p.fill));
      // mass needed, shown as orbiting seeds (one per 10 units), lit as they fill
      const seeds = Math.ceil(p.need / 10);
      for (let s = 0; s < seeds; s++) {
        const a = p.t * 0.6 + s / seeds * TAU; const on = p.count >= (s + 1) * 10;
        D.fx.push(p.x + Math.cos(a) * p.r * 1.12, p.y + Math.sin(a) * p.r * 1.12, on ? 6 : 4, 0, c[0], c[1], c[2], on ? 0.9 : 0.25, 0, 0, 0, 0);
      }
    }
    // the heart at the centre (co-op): brighter with each bloom
    if (this.game === 'hearts' && this.state !== 'choose') {
      const h = Math.min(1, 0.25 + this.hearts * 0.12), beat = 0.6 + 0.4 * Math.max(0, Math.sin(this.t * 4.2));
      D.ents.push(0, 0, 60, 5, 1, 0.62, 0.8, 1, h, 0, 0, 0);
      D.light(0, 0, 60, 380, 1, 0.6, 0.8, -(0.4 + h * beat));
      if (this.padHold > 0) D.fxTop.push(0, 0, 40 + this.padHold * 120, 6, 1, 0.8, 0.9, 0.6, 3, 0, 0, 0);
    }
    // off-screen rival indicators (P2 has no built-in PiP)
    const w = G.canvas.clientWidth, hh = G.canvas.clientHeight;
    const F = this.C[1].focus;
    if (F && F.alive) {
      const [sx, sy] = G.worldToScreen(F.B.cx, F.B.cy);
      if (sx < 0 || sy < 0 || sx > w || sy > hh) {
        const cx = Math.min(w - 30, Math.max(30, sx)), cy = Math.min(hh - 30, Math.max(30, sy));
        const [wx, wy] = G.screenToWorld(cx, cy);
        D.fxTop.push(wx, wy, 24 / z, 4, COL[1][0], COL[1][1], COL[1][2], 0.5, 3, 0, 0, 0);
      }
    }
  }

  zoomFit() { const G = this.G; return Math.min(G.canvas.clientWidth, G.canvas.clientHeight) / 1720; }

  camera(cam) {
    const G = this.G;
    const a = this.C[0].focus, b = this.C[1].focus;
    const W = G.canvas.clientWidth, H = G.canvas.clientHeight;
    const zMin = this.zoomFit(), zMax = Math.min(W, H) / 760;
    if (!a || !b || !a.alive || !b.alive || this.state === 'choose') { cam.tx = 0; cam.ty = 0; cam.tz = zMin; return; }
    const A = a.B, B = b.B;
    cam.tx = (A.cx + B.cx) / 2; cam.ty = (A.cy + B.cy) / 2;
    const sx = Math.abs(A.cx - B.cx) + A.r + B.r + 420, sy = Math.abs(A.cy - B.cy) + A.r + B.r + 360;
    cam.tz = Math.max(zMin, Math.min(zMax, Math.min(W / sx, H / sy)));
  }
}
