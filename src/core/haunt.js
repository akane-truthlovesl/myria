// ─────────────────────────────────────────────────────────────────────────────
//  Hauntings — what a dive leaves behind.
//
//  When a dive ends, the place it ended keeps something of the diver: a tacky
//  stain where it fell, false lights where it bled, and — for whoever comes that
//  deep later and steps in the stain — a pale revenant of the body it was.
//  "Whoever" is the same player on a later dive, or a stranger: a haunting packs
//  into one line of text that can be handed to anybody (no server, no account).
// ─────────────────────────────────────────────────────────────────────────────
const B36 = (n) => Math.max(0, Math.round(n)).toString(36);
const SYL = ['o', 'ru', 'tha', 'is', 'mae', 'ven', 'ul', 'ki', 'sor', 'an', 'el', 'yu', 'bri', 'ne', 'ash', 'io', 'ume', 'dra', 'li', 'os'];
// every haunting has a small name of its own, made from nothing but its number (nobody's real name ever travels with it)
export function hauntName(id) { let x = (id >>> 0) || 1; const pick = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return SYL[x % SYL.length]; }; const s = pick() + pick() + (x & 4 ? pick() : ''); return s[0].toUpperCase() + s.slice(1); }

// { id, depth, u, v, n, hue, dec:[[u,v]…] }  →  MYRIA-HAUNT.<id>.<depth>.<u>.<v>.<n>.<hue>[.<du>.<dv>]…
export function packHaunt(h) { return 'MYRIA-HAUNT.' + [h.id >>> 0, h.depth, h.u * 999, h.v * 999, h.n, h.hue | 0, ...(h.dec || []).slice(0, 3).flatMap(d => [d[0] * 999, d[1] * 999])].map(B36).join('.'); }
export function unpackHaunt(text) {
  const m = /MYRIA-HAUNT\.([0-9a-z.]+)/.exec(String(text || '')); if (!m) return null; const q = m[1].split('.').map(s => parseInt(s, 36)); if (q.length < 6 || q.some(v => !Number.isFinite(v))) return null;
  const c = (v, a, b) => Math.max(a, Math.min(b, v)); const dec = []; for (let k = 6; k + 1 < q.length && dec.length < 3; k += 2) dec.push([c(q[k] / 999, 0.05, 0.95), c(q[k + 1] / 999, 0.05, 0.95)]);
  return { id: q[0] >>> 0, depth: c(q[1], 1, 99), u: c(q[2] / 999, 0.05, 0.95), v: c(q[3] / 999, 0.05, 0.95), n: c(q[4], 20, 400), hue: c(q[5], 0, 9), dec, guest: true };
}
// the pale twin of a hue: what is left of a colour when the body is gone
export function ghostTint(tint) {
  const e = tint ? tint.emit : [1.0, 0.56, 0.36], a = tint ? tint.absorb : [0.05, 0.62, 1.05]; const mix = (x, y, k) => x + (y - x) * k;
  return { id: 'ghost-' + (tint ? tint.id : 'coral'), absorb: [a[0] * 0.3 + 0.06, a[1] * 0.3 + 0.05, a[2] * 0.3 + 0.03], emit: [mix(e[0], 0.86, 0.6), mix(e[1], 0.92, 0.6), mix(e[2], 1.0, 0.6)], glow: 0.95, halo: 0.85 };
}
