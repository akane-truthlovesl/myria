// ─────────────────────────────────────────────────────────────────────────────
//  Duet — two players, one screen. One steers with the pointer, the other with
//  the keys. The dish rains light for ninety seconds; drink it, grow — and
//  remember that the larger membrane siphons the smaller one.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { SURF } from '../sim/materials.js';
import { Colony } from '../life/colony.js';

const TINT2 = { id: 'duet2', absorb: [0.95, 0.30, 0.08], emit: [0.35, 0.9, 1.0], glow: 0.62, halo: 0.5 };
const LEN = 90;

export class Duet {
  constructor(app) { this.app = app; this.t = LEN; this.over = false; this.rain = 0; }
  enter() {
    const app = this.app; app.input.keysOff = true;
    app.travel((aspect) => { const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.3 }); geo.push({ op: 'add', t: 'circle', x: W / 2, y: H / 2, r: 46, mat: SURF.GLASS });
      return { name: 'Duet', seed: 21, W, H, geo, ents: [], spawn: { x: W * 0.25, y: H * 0.5, n: 40 }, pal: { deep: [0.012, 0.022, 0.05], mid: [0.04, 0.07, 0.14], wall: [0.07, 0.10, 0.18], rim: [0.6, 0.8, 1] } }; }, null, {
      onDark: () => app.applyBudget(),
      onLoad: (W) => { const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(W.spec.W * 0.75, W.spec.H * 0.5, 40); W.colonies.push(C); W.massCosts = true; },
      onReveal: () => { app.hud.showTitle('', 'Duet', 'pointer  ·  W A S D + Space', 3.2); app.hud.setCorner(true, () => app.pause()); },
    });
  }
  exit() { this.app.input.keysOff = false; }
  onEvent(e) {
    if (this.over || this.app.state !== 'play') return false;
    if (e.type === 'dartKey') { const F = this.p2.focus; if (F && F.alive) F.dart(F.facing.x, F.facing.y, 1); return true; }
    if (e.type === 'budKey' || e.type === 'cycle') return true;
    return false;
  }
  update(dt, W) {
    if (this.over) return;
    // player two: keys
    const K = this.app.input.keys; let x = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0), y = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
    if (x && y) { x *= 0.707; y *= 0.707; }
    const F = this.p2.focus; if (F && F.alive) { F.intent.x += (x - F.intent.x) * Math.min(1, dt * 20); F.intent.y += (y - F.intent.y) * Math.min(1, dt * 20); }
    for (const O of this.p2.orgs) if (O !== F && this.p2.focus) { O.rallyTo = this.p2.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }
    // light rains into the dish
    this.rain -= dt; if (this.rain <= 0 && W.pickups.length < 26) { this.rain = 0.35; for (let k = 0; k < 20; k++) { const px = 90 + Math.random() * (W.spec.W - 180), py = 90 + Math.random() * (W.spec.H - 180); if (W.phys.sampleSDF(px, py) > 30) { W.spawn({ type: 'mote', x: px, y: py, free: true, value: Math.random() < 0.15 ? 5 : 2 }); break; } } }
    this.t -= dt; if (this.t <= 0) this.end();
  }
  post(dt, W) { for (const C of [W.player, this.p2]) if (!C.orgs.some(o => o.alive)) { const s = C === W.player ? 0.25 : 0.75; C.spawn(W.spec.W * s, W.spec.H * 0.5, 24); W.fx.ring(W.spec.W * s, W.spec.H * 0.5, [1, 1, 1], 120, 0.8); } }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' || this.over || !this.p2) return;
    app.hud.setTop({ light: W.player.mass, total: 0, extra: `<span style="color:#ffb48a">●</span> &nbsp; ${Math.ceil(this.t)}s &nbsp; <span style="color:#7fe6ff">●</span> ${this.p2.mass}` });
  }
  end() {
    this.over = true; const app = this.app, W = app.world; const a = W.player.mass, b = this.p2.mass;
    app.sound.portal(); app.hud.setTop(null);
    app.hud.panel(a === b ? 'A perfect tie' : a > b ? 'Ember wins' : 'Tide wins', `${a} · ${b}`, [{ label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Duet(app)); } }, { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }]);
  }
}
