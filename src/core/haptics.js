// Haptics — progressive enhancement (Vibration API where available).
// Delicate ticks, never buzzing walls; rate-limited so it stays a whisper.
const can = typeof navigator !== 'undefined' && 'vibrate' in navigator;
let enabled = true, last = 0, tensionT = 0;
function buzz(p, minGap = 40) {
  if (!can || !enabled) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const t = performance.now(); if (t - last < minGap) return; last = t;
  try { navigator.vibrate(p); } catch (_) { /* ignore */ }
}
export const haptics = {
  get available() { return can; },
  set(on) { enabled = on; },
  tick() { buzz(6, 60); },                 // mote, focus
  thump(v = 0.5) { buzz(Math.round(10 + v * 25), 90); },
  snap() { buzz([8, 30, 14], 120); },
  fuse() { buzz([12, 40, 18], 150); },
  dart() { buzz(14, 80); },
  hurt() { buzz([20, 30, 20], 200); },
  // tension: micro-tremors rising toward the snap
  tension(x, dt) {
    if (x < 0.35) { tensionT = 0; return; }
    tensionT += dt * (4 + x * 14);
    if (tensionT >= 1) { tensionT = 0; buzz(Math.round(4 + x * 6), 50); }
  },
};
