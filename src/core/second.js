// ─────────────────────────────────────────────────────────────────────────────
//  The second player's hands, wherever they are:
//    · the keys of a shared keyboard (W A S D · Space to dart, held to lance · F to swell)
//    · the far half of a shared glass — two people at the two ends of one phone,
//      each half waking its own stick (input.split / input.stick2)
//    · the far end of a Link (core/link.js)
//    · or a neighbour the machine plays (a mode hands its intent in)
//  Modes that have a player two (Duet, the dive together) steer it through this.
// ─────────────────────────────────────────────────────────────────────────────
export class Second {
  constructor(app) { this.app = app; this.C = null; this.v = { x: 0, y: 0 }; }
  // the far half belongs to player two: the right of a wide glass, the top of a tall one
  static half(x, y) { const w = typeof innerWidth !== 'undefined' ? innerWidth : 1, h = typeof innerHeight !== 'undefined' ? innerHeight : 1; return w >= h ? (x > w / 2 ? 2 : 1) : (y < h / 2 ? 2 : 1); }
  enter() { const I = this.app.input; I.keysOff = true; I.split = (x, y) => Second.half(x, y); }
  exit() { const I = this.app.input; I.keysOff = false; I.keysSplit = false; I.split = null; if (I.stick2) I.stick2.active = false; }
  attach(C) { this.C = C; this.v.x = this.v.y = 0; }
  // what player two wills this frame (ai: { x, y, swell } from a neighbour, when the machine plays)
  update(dt, ai = null) {
    const C = this.C, I = this.app.input; if (!C) return; const F = C.focus;
    let x = 0, y = 0, swell = false;
    if (ai) { x = ai.x; y = ai.y; swell = !!ai.swell; }
    else {
      // (the arrows are player two's too — unless player one has them: two on one keyboard)
      const K = I.keys, ar = !I.keysSplit; x = (K.has('KeyD') || ar && K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || ar && K.has('ArrowLeft') ? 1 : 0); y = (K.has('KeyS') || ar && K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || ar && K.has('ArrowUp') ? 1 : 0);
      if (x && y) { x *= 0.707; y *= 0.707; } swell = K.has('KeyF');
      // Space held: player two coils, as player one does on the button — slowed, rays furled, a lance on release
      if (F) { const h = I.keyT0 ? (performance.now() - I.keyT0) / 1000 : 0; if (h > 0.22) { x *= 0.15; y *= 0.15; F.coil = Math.min(1, (h - 0.22) / 0.6); } else if (F.coil) F.coil = 0; }
      const s = I.vector2 && I.vector2(); if (s) { x = s.x; y = s.y; } if (I.swell2) swell = true;
      const L = this.app.link && this.app.link.p2(C); if (L && F) { x = L.x; y = L.y; swell = L.swell; for (const d of L.darts) F.dart(d.x, d.y, d.power); }
    }
    const V = C.pilot || (C.pilot = { x: 0, y: 0 }); V.x += (x - V.x) * Math.min(1, dt * 20); V.y += (y - V.y) * Math.min(1, dt * 20);
    if (F) F.swell = swell;
    // the pieces of player two follow player two
    for (const O of C.orgs) if (O !== F && F) { O.rallyTo = F.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }
  }
  // player two's verbs among the input events; true when one was theirs
  onEvent(e) {
    const C = this.C, F = C && C.focus, ok = F && F.alive, R = this.app.R;
    if (e.type === 'dartKey' && !e.p1) { if (ok) { const s = this.app.input.vector2 && this.app.input.vector2(); const dx = s ? s.x : F.facing.x, dy = s ? s.y : F.facing.y; F.dart(dx, dy, 0.9 + Math.min(1, (e.hold || 0) / 0.7) * 0.7); } return true; }
    if (e.type === 'tap2') { if (ok) { const [wx, wy] = R.cssToWorld(e.x, e.y); F.dart(wx - F.B.cx, wy - F.B.cy, 1); } return true; }
    if (e.type === 'dartDir2') { if (ok) F.dart(e.x, e.y, e.power); return true; }
    return e.type === 'budKey' || e.type === 'cycle';
  }
  // player two's stick, in player two's colour
  overlay(ov, R) {
    const S = this.app.input.stick2; if (!S || !S.active) return;
    const [ax, ay] = R.cssToWorld(S.ax, S.ay), [kx, ky] = R.cssToWorld(S.kx, S.ky); const r = this.app.input.stickRadius / (R.view.z / R.pxScale);
    ov.ring(ax, ay, r, 1.2 / R.view.z * R.pxScale, [0.45, 0.9, 1], 0.4); ov.glow(kx, ky, r * 0.5, [0.5, 0.92, 1], 0.5);
  }
}
