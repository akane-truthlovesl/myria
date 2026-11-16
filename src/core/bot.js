// ─────────────────────────────────────────────────────────────────────────────
//  Bot — a competent stand-in for a player's hands.
//
//  It plans paths on the room's distance field, reads the same diegetic cues a
//  player reads (pads, lanterns, films, pools, pores, bigger and smaller
//  neighbours) and uses the same verbs through the same `ctl` record. It powers
//  the headless playtests that prove every chamber can be finished, the soak
//  tests, and the `?bot` attract mode.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MATS, MAT } from '../sim/materials.js';
import { Nav, CS } from './nav.js';


const hz2 = (W) => (W.hazards ? W.hazards() : []);

export class Bot {
  // greed: 0 = leave as soon as the pore opens · 1 = take everything that is not dangerous · 2 = everything
  constructor(W, o = {}) { this.W = W; this.greed = o.greed ?? 1; this.nav = new Nav(W); this.t = 0; this.replan = 0; this.route = null; this.target = null; this.stuck = 0; this.px = 0; this.py = 0; this.skip = new Map(); this.budT = 0; this.rallyT = 0; this.wait = 0; this.notes = []; this.puffT = 0; this.lanceT = 0; }
  note(s) { if (this.notes[this.notes.length - 1] !== s) this.notes.push(s); }

  choose(F) {
    const W = this.W, B = F.B, pl = W.player; const cands = [];
    const add = (x, y, kind, ref, pri, r = 10) => { if (this.skip.get(ref) > this.t) return; cands.push({ x, y, kind, ref, pri, r }); };
    const need = this.padsWanted();
    const pore = W.ents.find(e => e.d.type === 'pore' && !e.taken && (!W.listener || !W.listener.portalFilter || W.listener.portalFilter(e)));
    // what you are comes first: a catalyst bath changes everything after it
    for (const e of W.ents) if (e.d.type === 'pool' && e.kind === 'morph' && B.mat !== e.mat && !this.morphed) add(e.x, e.y, 'pool', e, 0, e.r * 0.5);
    for (const e of W.ents) if (e.d.type === 'pool' && e.kind === 'heal' && e.given < e.max && pl.mass < (this.startMass || 60) * 0.7) add(e.x, e.y, 'heal', e, 1, e.r * 0.4);
    for (const e of W.ents) if ((e.d.type === 'lantern' || e.d.type === 'core' && B.mat === 4) && !e.lit) add(e.x, e.y, 'lantern', e, 2, 12);
    if (F.heat < -0.25) for (const e of W.ents) if (e.d.type === 'vent') add(e.x, e.y, 'vent', e, 1.5, e.r * 0.4);
    for (const e of W.ents) if (e.d.type === 'iceplug' && e.hp > 0) { if (F.heat > 0.25) add(e.S.x, e.S.y, 'ice', e, 2.4, 4); else for (const v of W.ents) if (v.d.type === 'vent') add(v.x, v.y, 'vent', v, 1.4, v.r * 0.4); }
    if (need.length) for (const p of need) add(p.x, p.y, 'pad', p, 3, p.r * 0.3);
    // a switch sealed behind a mesh: the place to go is the window in front of it (the room says where) — a piece of us will do the rest
    for (const p of need) if (p.d.from && !pl.orgs.some(o => o.alive && o !== F && Math.hypot(o.B.cx - p.x, o.B.cy - p.y) < p.r * 1.8)) add(p.d.from.x, p.d.from.y, 'sow', p, 3, 14);
    const hz = W.hazards();
    const risky = (x, y) => { for (const h of hz) if (Math.hypot(h.x - x, h.y - y) < h.r + 30) return true; return false; };
    const ready = pore && pore.open > 0.8;
    if (!(ready && this.greed === 0)) for (const m of W.pickups) { if (m.dead || m.held) continue; if (this.greed < 2 && risky(m.x, m.y)) continue; add(m.x, m.y, 'mote', m, 4, 8); }
    // neighbours: prey is food, especially when the pore asks for it
    // (prey sheltering beside something that would drink us is not prey yet)
    const guarded = (x, y) => { for (const C of W.colonies) { if (C === pl || C.ally || !C.kind || C.kind === 'oil') continue; for (const O of C.orgs) if (O.alive && O.B.count > B.count * 1.1 && MATS[O.B.mat].phase === MATS[B.mat].phase && Math.hypot(O.B.cx - x, O.B.cy - y) < O.B.r + 120) return true; } return false; };
    for (const C of W.colonies) { if (C === pl || C.ally || !C.kind || C.kind === 'oil' || C.kind === 'thorn') continue; for (const O of C.orgs) { if (!O.alive) continue; if (O.B.count * 1.2 < B.count && MATS[O.B.mat].phase === MATS[B.mat].phase && !guarded(O.B.cx, O.B.cy)) add(O.B.cx, O.B.cy, 'prey', O, C.kind === 'hunter' ? 3.5 : 4.2, 6); } }
    // spore-bodied, and something far too big is about: leave it a present (one at a time), then be elsewhere
    const spore = B.mat === MAT.SPORE; const decoyOut = spore && pl.orgs.some(o => o.alive && o !== F && o.B.count >= 6);
    if (spore && !decoyOut && B.count >= 30 && this.budT <= 0) for (const C of W.colonies) { if (C === pl || C.ally || C.kind !== 'hunter') continue; for (const O of C.orgs) if (O.alive && O.B.count > B.count * 1.15 && !(O.boomT > 0)) add(O.B.cx, O.B.cy, 'bait', O, 3.4, 6); }
    // nothing left to eat but something too big to swallow: go and cleave it (a lance parts any neighbour in two)
    if (!spore && !cands.some(c => c.kind === 'mote' || c.kind === 'prey') && B.count > 18) for (const C of W.colonies) { if (C === pl || C.ally || C.kind !== 'hunter') continue; for (const O of C.orgs) if (O.alive && O.B.count >= 18 && O.B.count * 1.2 >= B.count) add(O.B.cx, O.B.cy, 'cleave', O, 5, 6); }
    // doubled films only give way to a flight: when one is up, the bands that throw at it (straight, or by way of another band) are places to go
    const tough = W.ents.filter(e => e.d.type === 'film' && e.tough && e.S.active);
    if (tough.length) for (const e of W.ents) { if (e.d.type !== 'bumper') continue; let q = e, hops = 0, hit = false; while (q && hops++ < 5) { const fx = q.to ? q.to.x : q.x + q.nx * 300, fy = q.to ? q.to.y : q.y + q.ny * 300; if (tough.some(t => Math.hypot(t.x - fx, t.y - fy) < t.len * 0.5)) { hit = true; break; } q = W.ents.find(o => o.d.type === 'bumper' && o !== q && Math.hypot(o.x - fx, o.y - fy) < 70); } if (hit) add(e.x + e.nx * 64, e.y + e.ny * 64, 'bumper', e, 5, 10); }
    if (ready) add(pore.x, pore.y, 'pore', pore, cands.some(c => c.kind === 'mote' || c.kind === 'prey') && this.greed > 0 ? 6 : 1, pore.r * 0.3);
    if (!cands.length) { if (pore) return { x: pore.x, y: pore.y, kind: 'wait', ref: pore, r: pore.r * 2.2 }; return null; }
    // lowest priority class first; inside a class the shortest real path wins (checked for the few nearest by air)
    cands.sort((a, b) => a.pri - b.pri || Math.hypot(a.x - B.cx, a.y - B.cy) - Math.hypot(b.x - B.cx, b.y - B.cy));
    const top = cands.filter(c => c.pri === cands[0].pri).slice(0, 5); let best = null, bl = 1e9;
    for (const c of top) { const p = this.nav.path(B.cx, B.cy, c.x, c.y); if (!p) { this.skip.set(c.ref, this.t + 4); continue; } if (p.cost < bl) { bl = p.cost; best = c; best.route = p; } }
    if (!best) { for (const c of cands.slice(top.length)) { const p = this.nav.path(B.cx, B.cy, c.x, c.y); if (p) { c.route = p; return c; } } }
    return best;
  }

  step(dt, ctl) {
    const W = this.W, pl = W.player; const F = pl && pl.focus; this.t += dt;
    ctl.intent.x = 0; ctl.intent.y = 0; ctl.rally = false; ctl.swell = false; ctl.darts = null; ctl.buds = null;
    if (!F || !F.alive) return ctl; const B = F.B; if (!this.startMass) this.startMass = pl.mass;
    if (F.flightT > 0) { this.replan = 0; this.note('fly'); return ctl; }          // thrown: trust the arc
    if (B.mat !== 0) this.morphed = true;
    this.budT -= dt; this.rallyT -= dt; this.wait -= dt; this.replan -= dt; this.puffT -= dt;
    const pads = W.ents.filter(e => e.d.type === 'pad'); const need = this.padsWanted();
    // several pads at once → throw siblings onto all but the last, sit on the last yourself
    if (need.length >= 2 && this.budT <= 0 && pl.orgs.filter(o => o.alive).length < pads.length) {
      // (a pad we cannot walk to — it is behind a one-way door — is the one to throw at; otherwise the nearest)
      const reach = (q) => (this.nav.sc ? !!this.nav.path(B.cx, B.cy, q.x, q.y) : true); const cand = need.filter(q => !q.d.from);
      const p = cand.slice().sort((a, b) => (reach(a) ? 1 : 0) - (reach(b) ? 1 : 0) || Math.hypot(a.x - B.cx, a.y - B.cy) - Math.hypot(b.x - B.cx, b.y - B.cy))[0] || need[0]; const d = Math.hypot(p.x - B.cx, p.y - B.cy);
      const taken = pl.orgs.some(o => o.alive && o !== F && Math.hypot(o.B.cx - p.x, o.B.cy - p.y) < p.r * 1.7);
      if (!taken && d < 300 && d > 60 && !W.phys.raycast(B.cx, B.cy, (p.x - B.cx) / d, (p.y - B.cy) / d, d - 10) && B.count > p.need * 2 + 12) { ctl.buds = [{ x: p.x, y: p.y, frac: Math.min(0.45, (p.need + 9) / B.count) }]; this.budT = 2.2; this.skip.set(p, this.t + 6); this.note('bud→pad'); this.replan = 0; }
    }
    if (pads.length && !need.length && pl.orgs.length > 1 && this.rallyT < -4) { this.rallyT = 3.5; this.note('rally'); }
    if (need.length >= 2 && pl.orgs.filter(o => o.alive).length >= pads.length) { this.strayT = (this.strayT || 0) + dt; if (this.strayT > 5) { this.strayT = 0; this.rallyT = 3; this.budT = 3.4; this.note('regroup'); } } else this.strayT = 0;
    // siblings nothing is asking for: call them home (a comb, a cut, a throw scattered us) — and never leave through the pore without them
    const baiting = B.mat === MAT.SPORE && W.colonies.some(C => C.kind === 'hunter' && C.orgs.some(o => o.alive && o.B.count > B.count * 1.15));
    // decoys that nothing has found in nine seconds are in the wrong place: call them home and lay them again
    if (baiting) { const out = pl.orgs.some(o => o.alive && o !== F && o.B.count >= 6), lit = W.colonies.some(C => C.kind === 'hunter' && C.orgs.some(o => o.alive && (o.boomT > 0 || o.B.spores > 0))); this.staleT = out && !lit ? (this.staleT || 0) + dt : 0; if (this.staleT > 9) { this.rallyT = 2.6; this.staleT = 0; this.note('recall'); } }
    if (!pads.length && !baiting && this.rallyT < -2.5) { let stray = 0; for (const o of pl.orgs) if (o.alive && o !== F) stray += o.B.count; if (stray >= 6 && (stray > B.count * 0.25 || this.target && this.target.kind === 'pore')) { this.rallyT = 2.6; this.note('rally'); } }
    if (this.rallyT > 0) ctl.rally = true;
    // decide / re-plan
    if (this.replan <= 0 || !this.target || this.target.ref && (this.target.ref.dead || this.target.kind === 'lantern' && this.target.ref.lit)) {
      this.replan = 0.45; this.nav.build(this.greed === 2 ? 0.4 : 1, { count: B.count }); this.target = this.choose(F); this.route = this.target ? this.target.route || this.nav.path(B.cx, B.cy, this.target.x, this.target.y) : null; this.wp = 1;
    }
    const T = this.target; if (!T) return ctl;
    if ((T.kind === 'prey' || T.kind === 'cleave' || T.kind === 'bait') && T.ref.alive) { T.x = T.ref.B.cx; T.y = T.ref.B.cy; }
    if (T.kind === 'lantern' && T.ref.orb) { T.x = T.ref.x; T.y = T.ref.y; }
    // follow the route: aim at the furthest waypoint still in line of sight
    let ax = T.x, ay = T.y;
    if (this.route) { const pts = this.route.pts; let k = Math.min(this.wp, pts.length - 1); while (k < pts.length - 1 && Math.hypot(pts[k][0] - B.cx, pts[k][1] - B.cy) < 26) k++; let far = k; for (let q = Math.min(pts.length - 1, k + 6); q > k; q--) { const dx = pts[q][0] - B.cx, dy = pts[q][1] - B.cy, d = Math.hypot(dx, dy) + 1; if (!W.phys.raycast(B.cx, B.cy, dx / d, dy / d, d - 6) && this.clear(B.cx, B.cy, pts[q][0], pts[q][1])) { far = q; break; } } this.wp = k; ax = pts[far][0]; ay = pts[far][1]; }
    if (T.kind === 'bumper') { const e = T.ref; const off = (B.cx - e.x) * e.nx + (B.cy - e.y) * e.ny, al = Math.abs((B.cx - e.x) * -e.ny + (B.cy - e.y) * e.nx); if (off > 0 && off < 120 && al < e.len * 0.3) { ax = e.x - e.nx * 40; ay = e.y - e.ny * 40; } }      // squarely in front of its bright face: lean in
    let dx = ax - B.cx, dy = ay - B.cy; const d = Math.hypot(dx, dy) + 1e-3; const dT = Math.hypot(T.x - B.cx, T.y - B.cy);
    let thr = 1;
    if (T.kind === 'pad' || T.kind === 'wait' || T.kind === 'pool' || T.kind === 'heal' || T.kind === 'vent' || T.kind === 'pore') thr = dT < T.r ? 0 : Math.min(1, dT / 70 + 0.15);       // arrive like a player does: ease in, then rest
    ctl.intent.x = dx / d * thr; ctl.intent.y = dy / d * thr; ctl.aim = { x: ax, y: ay };
    if (T.kind === 'prey' && dT < 150 && dT > T.ref.B.r + B.r * 0.6 && F.dartCD <= 0 && B.count > 40 && this.lanceT < this.t) { ctl.darts = [{ x: T.x - B.cx, y: T.y - B.cy, power: 1 }]; this.lanceT = this.t + 1.6; this.note('pounce'); }
    if (T.kind === 'sow' && dT < 34 && this.budT <= 0 && B.count > T.ref.need * 2 + 8) { ctl.buds = [{ x: T.ref.x, y: T.ref.y, frac: Math.min(0.42, (T.ref.need + 10) / B.count) }]; this.budT = 2.4; this.skip.set(T.ref, this.t + 5); this.replan = 0; this.note('sow'); }
    if (T.kind === 'bait' && T.ref.alive && this.budT <= 0) { const edge = dT - T.ref.B.r - B.r; if (edge < 200) { const k = Math.min(0.42, Math.max(0.22, 16 / B.count)), reach = Math.max(40, edge * 0.45 + B.r); ctl.buds = [{ x: B.cx + (T.x - B.cx) / dT * reach, y: B.cy + (T.y - B.cy) / dT * reach, frac: k }]; this.budT = 5; this.skip.set(T.ref, this.t + 5); this.replan = 0; this.fleeT = this.t + 2.2; this.fleeFrom = T.ref; this.note('decoy'); } }
    if (this.fleeT > this.t && this.fleeFrom && this.fleeFrom.alive) { const ex = B.cx - this.fleeFrom.B.cx, ey = B.cy - this.fleeFrom.B.cy, ed = Math.hypot(ex, ey) + 1; if (ed < 420) { ctl.intent.x = ex / ed; ctl.intent.y = ey / ed; } }      // …and be elsewhere
    if (T.kind === 'cleave' && T.ref.alive && dT < T.ref.B.r + B.r + 70 && F.dartCD <= 0 && this.lanceT < this.t) { ctl.darts = [{ x: T.x - B.cx, y: T.y - B.cy, power: 1.5 }]; this.lanceT = this.t + 1.8; this.note('lance'); }
    // effervescent: jets are free, and the only way over a river
    if (F.morph && F.morph.jet && d > 46 && F.dartCD <= 0 && T.kind !== 'pool' && !(T.kind === 'pore' && dT < 110)) { ctl.darts = [{ x: dx, y: dy, power: 1 }]; this.note('jet'); }
    // a film ahead means: dart
    for (const e of W.ents) if (e.d.type === 'film' && !e.tough && e.S.active && F.dartCD <= 0) { const fx = e.x - B.cx, fy = e.y - B.cy; const along = (fx * dx + fy * dy) / d; if (along > 0 && along < 120 && Math.abs(fx * dy - fy * dx) / d < e.len * 0.5) { ctl.darts = [{ x: dx, y: dy, power: 1.4 }]; this.note('dart→film'); } }
    // bigger neighbours: keep away (unless we are a different phase and cannot be siphoned)
    for (const C of W.colonies) { if (C === pl || C.ally || !C.kind || C.kind === 'oil') continue; for (const O of C.orgs) { if (!O.alive) continue; const big = O.B.count > B.count * 1.1 * (1 + 1.2 * (B.inflate || 0)) && MATS[O.B.mat].phase === MATS[B.mat].phase || C.kind === 'thorn' && B.mat !== 3; if (!big || T.kind === 'cleave' && T.ref === O) continue; const ex = B.cx - O.B.cx, ey = B.cy - O.B.cy, ed = Math.hypot(ex, ey) - O.B.r - B.r; if (ed < 130) { const s = (1 - Math.max(0, ed) / 130) * 2.4; ctl.intent.x += ex / (ed + O.B.r + B.r) * s; ctl.intent.y += ey / (ed + O.B.r + B.r) * s; if (ed < 46 && C.kind === 'hunter' && F.canSwell && this.puffT < -1.5) this.puffT = 1.2; if (ed < 60 && ed > 8 && C.kind === 'hunter' && F.dartCD <= 0 && B.count > 30 && this.lanceT < this.t) { ctl.darts = [{ x: -ex, y: -ey, power: 1.5 }]; this.lanceT = this.t + 2.5; this.note('lance'); continue; } if (ed < 26 && F.dartCD <= 0 && B.count > 20) { ctl.darts = [{ x: ex, y: ey, power: 1 }]; this.note('dart-away'); } } } }
    // teeth that travel: step out of their way (still ones are the planner's business)
    for (const h of hz2(W)) { if (!h.moving) continue; const ex = B.cx - h.x, ey = B.cy - h.y, ed = Math.hypot(ex, ey) - h.r - B.r; if (ed < 64) { const s = (1 - Math.max(0, ed) / 64) * 2.6; ctl.intent.x += ex / (ed + h.r + B.r + 1) * s; ctl.intent.y += ey / (ed + h.r + B.r + 1) * s; } }
    // a pole about to throw us: lean where we want to land (its twin if that still sleeps, else the next thing we wanted)
    if (B.mat === 4) for (const e of W.ents) if (e.d.type === 'core' && e.warn && Math.hypot(e.x - B.cx, e.y - B.cy) < e.r + B.r + 14) { const tw = e.twin; const g = tw && !tw.lit && (e.lit || e.charge > e.need * 0.5) ? tw : !e.lit ? null : T.ref !== e ? T : null; if (g) { const gx = g.x - e.x, gy = g.y - e.y, gd = Math.hypot(gx, gy) + 1e-3; ctl.intent.x = gx / gd; ctl.intent.y = gy / gd; this.note('aim-throw'); } else { ctl.intent.x = 0; ctl.intent.y = 0; } }
    if (this.puffT > 0) { ctl.swell = true; this.note('puff'); }
    const m = Math.hypot(ctl.intent.x, ctl.intent.y); if (m > 1) { ctl.intent.x /= m; ctl.intent.y /= m; }
    // stuck? push harder, then think again
    const held = B.mat === 4 && W.ents.some(e => e.d.type === 'magnet' && e.onK > 0.4 && Math.hypot(e.x - B.cx, e.y - B.cy) < e.reach * 0.7);       // a pole has us: wait for its pulse
    if (thr > 0.3 && !held) { if (Math.hypot(B.cx - this.px, B.cy - this.py) < 14) this.stuck += dt; else { this.stuck = 0; this.px = B.cx; this.py = B.cy; } } else this.stuck = 0;
    if (this.stuck > 2.6 && F.dartCD <= 0 && B.count > 34 && W.massCosts !== undefined) { ctl.darts = [{ x: dx, y: dy, power: 1.2 }]; this.note('dart-unstick'); this.stuck = 1.2; this.unstuck = (this.unstuck || 0) + 1; if (this.unstuck > 3 && T.ref) { this.skip.set(T.ref, this.t + 8); this.unstuck = 0; this.replan = 0; this.note('give-up:' + T.kind); } }
    return ctl;
  }
  // pads that something is still waiting for (a gate that has not latched open, a pore keyed directly on them)
  padsWanted() {
    const W = this.W; const ids = new Set(); const flat = (c) => { if (!c) return; if (typeof c === 'string') ids.add(c); else if (Array.isArray(c)) c.forEach(flat); else if (c.any) c.any.forEach(flat); };
    for (const e of W.ents) { if (e.d.type === 'gate' && !e.latched && e.k < 0.5) flat(e.need); if (e.d.type === 'pore' && e.d.key) flat(e.d.key); }
    return W.ents.filter(e => e.d.type === 'pad' && ids.has(e.id) && !e.active);
  }
  // straight segment stays in cheap cells? (keeps shortcuts from cutting through hazards)
  clear(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / CS); const nav = this.nav; for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; const i = Math.floor(x / CS), j = Math.floor(y / CS); const c = nav.cost[j * nav.w + i]; if (!(c > 0) || c > 9) return false; } return true; }
}
