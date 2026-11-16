// Haptics — progressive enhancement (Vibration API where available).
// Delicate ticks, never buzzing walls; rate-limited so it stays a whisper.
const can = typeof navigator !== 'undefined' && 'vibrate' in navigator;
let enabled = true, last = 0, lastPri = 0, tensionT = 0;
// pri: 0 whispers (a light eaten, a tremor) · 1 your own acts (dart, thump) · 2 what happens to you (snap, fuse, hurt).
// A cue is dropped only if something of its own weight or heavier spoke within its gap — a whisper never swallows an act
// (measured by tools/browser/senses.mjs: a light eaten 80 ms before a dart used to silence the dart).
function buzz(p, minGap = 40, pri = 0) {
  if (!can || !enabled) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const t = performance.now(); if (t - last < minGap && pri <= lastPri) return; last = t; lastPri = pri;
  try { navigator.vibrate(p); } catch (_) { /* ignore */ }
}
export const haptics = {
  get available() { return can; },
  set(on) { enabled = on; },
  tick() { buzz(6, 60, 0); },                 // mote, focus
  thump(v = 0.5) { buzz(Math.round(10 + v * 25), 90, 1); },
  snap() { buzz([8, 30, 14], 120, 2); },
  fuse() { buzz([12, 40, 18], 150, 2); },
  dart() { buzz(14, 80, 1); },
  hurt() { buzz([20, 30, 20], 200, 2); },
  // tension: micro-tremors rising toward the snap
  tension(x, dt) {
    if (x < 0.35) { tensionT = 0; return; }
    tensionT += dt * (4 + x * 14);
    if (tensionT >= 1) { tensionT = 0; buzz(Math.round(4 + x * 6), 50); }
  },
};
