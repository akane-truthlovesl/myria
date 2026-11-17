// ─────────────────────────────────────────────────────────────────────────────
//  The Atrium — title, opening hook and mode select in one living room.
//  The word MYRIA is written in motes: you wake a sleeping pearl, and it eats
//  the title. Pores lead onward; their names are the only words on screen.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { ROOMS, STRATA, stratumOf } from '../world/odyssey.js';
import { moteTrail } from '../world/entities.js';
import { shoalOf, fireflyCloud } from '../world/plankton.js';
import { Odyssey, TRICKS } from './odyssey.js';
import { SKINS, skinFor, unlockedSkins } from '../core/skins.js';
import { DAWN } from './epilogue.js';
import { album } from '../core/album.js';

// stroke font on a 4×6 grid
const GLYPH = {
  M: [[[0, 6], [0, 0], [2, 3.2], [4, 0], [4, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  R: [[[0, 6], [0, 0], [2.8, 0], [4, 1.1], [4, 2.1], [2.8, 3.2], [0, 3.2]], [[2.2, 3.2], [4, 6]]],
  I: [[[2, 0], [2, 6]], [[0.8, 0], [3.2, 0]], [[0.8, 6], [3.2, 6]]],
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4], [3, 4]]],
};
function wordMotes(word, cx, cy, width) {
  const n = word.length; const cell = width / (n * 4 + (n - 1) * 2.2); const out = [];
  const x0 = cx - width / 2, y0 = cy - cell * 3;
  [...word].forEach((ch, k) => {
    const ox = x0 + k * cell * 6.2;
    for (const st of GLYPH[ch]) {
      let len = 0; for (let i = 0; i < st.length - 1; i++) len += Math.hypot(st[i + 1][0] - st[i][0], st[i + 1][1] - st[i][1]);
      const pts = st.map(p => [ox + p[0] * cell, y0 + p[1] * cell]);
      out.push(...moteTrail(pts, Math.max(2, Math.round(len * cell / 17) + 1), 1));
    }
  });
  return out;
}

import { unpackHaunt, hauntName } from '../core/haunt.js';

export class Hub {
  constructor(app, o = {}) { this.app = app; this.o = o; this.isHub = true; this.awake = !!o.result || !!o.awake; this.t = 0; }
  enter() {
    const app = this.app, save = app.save; const cleared = ROOMS.filter(r => save.room(r.id)).length;
    this.next = Math.min(ROOMS.length - 1, ROOMS.findIndex(r => !save.room(r.id)) < 0 ? 0 : ROOMS.findIndex(r => !save.room(r.id)));
    this.dests = [{ id: 'odyssey', name: 'Odyssey', sub: cleared ? `${cleared >= ROOMS.length ? 'all chambers lit' : 'continue · ' + ROOMS[this.next].name} · ${save.stars()} ✦` : 'begin', open: true }];
    for (const d of app.extraModes || []) this.dests.push({ ...d, open: d.unlock ? d.unlock(cleared, save) : true });
    // a brand-new save meets one door: the way in. The others arrive — all at once, as a gift — when the first chamber has been lit.
    if (!cleared && !(app.params && app.params.has('all'))) this.dests = this.dests.filter(d => d.id === 'odyssey');
    app.travel((aspect) => {
      const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.3 });
      const ents = wordMotes('MYRIA', W / 2, H * 0.30, Math.min(W * 0.72, 760));
      // a halo of dew round the sleeper, just past the reach of its feelers: whichever way a first, unknowing nudge goes, it is answered with light inside a second
      //  (measured with tools/browser/stranger.mjs — a thumb wandering at random used to need a median of four seconds to stumble on the word above)
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * 6.2832; ents.push({ type: 'mote', x: W / 2 + Math.cos(a) * 104, y: H * 0.55 + Math.sin(a) * 104, value: 1, col: [0.80, 0.95, 1.0] }); }
      const n = this.dests.length; this.pores = [];
      this.dests.forEach((d, k) => { const x = W * (n === 1 ? 0.5 : 0.16 + 0.68 * k / (n - 1)), y = H * (W < H * 1.2 && n > 3 ? (k % 2 ? 0.86 : 0.70) : 0.76); ents.push({ type: 'pore', x, y, r: 40, dest: d.id, col: d.col || (k === 0 ? [1.0, 0.72, 0.5] : [0.45, 0.95, 1.0]) }); });
      ents.push(...this.homeLife(W, H, Math.min(W * 0.72, 760), ents));
      return { name: 'Atrium', seed: 3, W, H, geo, ents, spawn: { x: W / 2, y: H * 0.55, n: 14 }, pal: save.get('awake', 0) ? { ...DAWN, grid: 0.8 } : { grid: 0.8 } };       // once the slide is awake, the Atrium keeps the morning
    }, null, {
      minDark: this.o.result ? 2.6 : 0.35,
      onDark: () => { app.applyBudget(); if (this.o.result) app.hud.showResult(this.o.result); },
      onLoad: (W) => { if (!this.awake) for (const O of W.player.orgs) O.dormant = true; this.lettersTotal = W.stats.motesTotal; },
      onReveal: () => { app.hud.hideResult(); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('atrium');
        const n = unlockedSkins(save).length, seen = save.get('huesSeen', 1); if (n > seen) { save.set('huesSeen', n); app.hud.toast(`a new hue · ${SKINS[n - 1].name} <small>pause to wear it</small>`, '✺'); }
        const home = this.home || [], had = save.get('homeSeen', 0); if (home.length > had) { save.set('homeSeen', home.length); setTimeout(() => { if (app.mode === this) app.hud.toast(home[home.length - 1], '❋', 'cool'); }, 1400); } },
    });
  }
  exit() { this.app.hud.setLabels([]); }
  pauseItems() { const app = this.app; const found = TRICKS.filter(t => (app.save.data.tricks || {})[t[0]]).length, kept = album.count(); return [{ label: 'Chambers', fn: () => this.chambers() }, { label: `Tricks · ${found} / ${TRICKS.length}`, fn: () => this.journal() }, ...(kept ? [{ label: `Album · ${kept}`, fn: () => this.albumPanel() }] : []), { label: this.hueLabel(), fn: (b) => { this.nextHue(); b.innerHTML = this.hueLabel(); } }, { label: 'Race an echo', fn: () => this.raceEcho() }, { label: this.hauntLabel(), fn: () => this.inviteHaunt() }, ...(app.save.get('awake', 0) ? [{ label: 'Myriad', fn: () => { app.resume(); app.toEpilogue({}); } }] : [])]; }
  hueLabel() { const save = this.app.save; const cur = skinFor(save); const nx = SKINS.find(s => s.need > save.stars()); return `Hue · ${cur.name}${nx ? ` <small style="opacity:.55;letter-spacing:.1em;text-transform:none">&nbsp; next: ${nx.name} at ${nx.need} ✦</small>` : ''}`; }
  nextHue() {
    const app = this.app, save = app.save; const list = unlockedSkins(save); const cur = skinFor(save); const nx = list[(list.indexOf(cur) + 1) % list.length]; save.set('skin', SKINS.indexOf(nx));
    const W = app.world, C = W.player; if (C) { C.tint = nx.tint; for (const O of C.orgs) if (O.alive) { O.B.tint = nx.tint; O.crown.joy(); W.fx.ring(O.B.cx, O.B.cy, (nx.tint || { emit: [1, 0.6, 0.4] }).emit, 140, 0.8); } } app.sound.morph();
  }
  // the album: the moments the game kept by itself, newest first (a tap makes one large)
  albumPanel() {
    const app = this.app, L = album.list().slice().reverse(), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const day = (t) => { try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    const cells = L.map((m) => `<figure class="al"><img src="${esc(m.src)}" alt=""><figcaption><b>${esc(m.caption)}</b><span>${esc(m.sub || '')}</span><i>${day(m.t)}</i></figcaption></figure>`).join('');
    app.hud.panel('Album', `${L.length} moment${L.length === 1 ? '' : 's'} kept`, [{ label: 'Back', cls: 'pri', fn: () => app.resume() }], `<div class="al-grid">${cells}</div>`);
    const veil = app.hud.veil; veil.querySelector('.panel').classList.add('wide');
    veil.querySelectorAll('.al').forEach(f => { f.onclick = (e) => { e.stopPropagation(); const on = !f.classList.contains('big'); veil.querySelectorAll('.al.big').forEach(q => q.classList.remove('big')); if (on) { f.classList.add('big'); f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } app.sound.ui(); }; });
  }
  // the journal: what you have found has a name; what you have not is a riddle
  journal() {
    const app = this.app, got = app.save.data.tricks || {};
    const rows = TRICKS.map(([name, riddle]) => (got[name] ? `<div class="tk on"><b>✦ ${name}</b><span>${riddle}</span><i>×${got[name]}</i></div>` : `<div class="tk"><b>· · ·</b><span>${riddle}</span><i></i></div>`)).join('');
    app.hud.panel('Tricks', 'noticed when you find them', [{ label: 'Back', cls: 'pri', fn: () => app.resume() }], `<div class="tk-list">${rows}</div>`);
    app.hud.veil.querySelector('.panel').classList.add('wide');
  }
  // a friend's echo: a code on the clipboard (or typed in) becomes a pale blue bead to race through that chamber
  // hauntings: what earlier dives left in the Abyss — yours, and any a stranger handed you (core/haunt.js)
  hauntLabel() { const list = this.app.save.get('haunts', []); const g = list.filter(q => q.guest).length; return `Invite a haunting${list.length ? ` <small style="opacity:.55;letter-spacing:.1em;text-transform:none">&nbsp; ${list.length} waiting${g ? ' · ' + g + ' from strangers' : ''}</small>` : ''}`; }
  async inviteHaunt() {
    const app = this.app; let txt = '';
    try { if (navigator.clipboard && window.isSecureContext) txt = await navigator.clipboard.readText(); } catch (_) { txt = ''; }
    if (!/MYRIA-HAUNT\./.test(txt)) { try { txt = window.prompt('Paste a haunting') || ''; } catch (_) { txt = ''; } }
    const h = unpackHaunt(txt); if (!h) { app.hud.toast('nothing lingers in that', '☍', 'cool'); return; }
    const list = app.save.get('haunts', []).filter(q => q.id !== h.id); list.push(h); while (list.filter(q => q.guest).length > 6) list.splice(list.findIndex(q => q.guest), 1); app.save.set('haunts', list);
    app.sound.ui(); app.resume(); app.hud.toast(`${hauntName(h.id)} waits for you at depth ${h.depth}`, '☍', 'cool');
  }
  async raceEcho() {
    const app = this.app; let txt = '';
    try { if (navigator.clipboard && window.isSecureContext) txt = await navigator.clipboard.readText(); } catch (_) { txt = ''; }
    if (!/MYRIA-ECHO\./.test(txt)) { try { txt = window.prompt('Paste an echo') || ''; } catch (_) { txt = ''; } }
    const m = /MYRIA-ECHO\.([a-z0-9-]+)\.([0-9.]+)\.([A-Za-z0-9_-]+)/.exec(txt); const i = m ? ROOMS.findIndex(r => r.id === m[1]) : -1;
    if (i < 0) { app.hud.toast('no echo there', '◷', 'cool'); return; }
    app.rivalEcho = { id: m[1], t: +m[2], p: m[3] }; app.sound.ui(); app.resume(); app.setMode(new Odyssey(app, i, { single: true }));
  }
  // the Odyssey as a map: four strata, each closed by its warden
  chambers() {
    const app = this.app, save = app.save; const RN = ['I', 'II', 'III', 'IV']; const nextI = ROOMS.findIndex(r => !save.room(r.id));
    const open = (i) => i === 0 || !!save.room(ROOMS[i - 1].id) || app.params.has('all');
    const cell = (r, i) => { const rec = save.room(r.id); const cls = ['ch', open(i) ? '' : 'locked', r.boss ? 'boss' : '', i === nextI ? 'next' : '', rec && rec.stars.every(Boolean) ? 'full' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-i="${i}"><b>${i + 1}</b><span>${r.name}</span><i>${rec ? rec.stars.map(q => (q ? '◆' : '◇')).join('') : open(i) ? '···' : '&nbsp;'}</i></button>`; };
    const rows = STRATA.map((S, k) => { const cells = ROOMS.map((r, i) => (stratumOf(i) === k ? cell(r, i) : '')).join(''); const got = ROOMS.reduce((n, r, i) => n + (stratumOf(i) === k && save.room(r.id) ? save.room(r.id).stars.filter(Boolean).length : 0), 0), of = ROOMS.filter((r, i) => stratumOf(i) === k).length * 3;
      return `<div class="ch-row"><label>${RN[k]} · ${S.name}<small>${got} / ${of} ✦</small></label><div class="ch-cells">${cells}</div></div>`; }).join('');
    app.hud.panel('Chambers', `${save.stars()} ✦ gathered`, [{ label: 'Back', cls: 'pri', fn: () => app.resume() }], `<div class="ch-map">${rows}</div>`);
    const veil = app.hud.veil; veil.querySelector('.panel').classList.add('wide');
    veil.querySelectorAll('.ch').forEach(b => { b.onclick = (e) => { e.stopPropagation(); const i = +b.dataset.i; if (!open(i)) return; app.sound.ui(); app.resume(); app.setMode(new Odyssey(app, i, { single: false })); }; });
  }
  wake() {
    if (this.awake) return; this.awake = true; const W = this.app.world;
    for (const O of W.player.orgs) { O.dormant = false; O.crown.joy(); O.excite = 1; W.fx.ring(O.B.cx, O.B.cy, [1, 0.8, 0.6], 160, 1.0); W.fx.burst(O.B.cx, O.B.cy, 14, [1, 0.85, 0.6], 150, { life: 0.9 }); }
    const snd = this.app.sound; snd.init(); if (snd.ready) { snd.bloom(); snd.ambience('atrium'); }
  }
  // the whole word eaten: the dish answers — a breath of light from the creature, a chord, and a fuse of dew that runs from it to the way in
  // (only the word and its halo of dew: the living light that came home is a treat, not a chore between you and the chord)
  mote() { const W = this.app.world; if (!this.wordDone && !W.pickups.some(p => p.isMote && !p.dead && !p.kind && !p.d.gift)) this.wordEaten(); }
  // the living light of the places you have lit follows you home — the Atrium fills, stratum by stratum:
  //   your first chamber brings fireflies · the Dew a school circling the word · the Glassworks seed pods on the ceiling ·
  //   Chemistry shy sparks and drifting light · the Heart a golden swarm over everything
  homeLife(W, H, ww, ents) {
    const save = this.app.save, lit = (id) => !!save.room(id), out = [], said = this.home = [];
    const cleared = ROOMS.filter(r => save.room(r.id)).length;
    // the dish is a rounded box (margin 34, corners min(W,H)·0.3, a rim that wobbles a little): how far a point sits inside it,
    // and whether a spot is clear of the rim and of the doors
    const m = 34, rr = Math.min(W, H) * 0.3, inside = (x, y) => { const qx = Math.abs(x - W / 2) - (W / 2 - m - rr), qy = Math.abs(y - H / 2) - (H / 2 - m - rr); return rr - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0); };
    const doors = ents.filter(e => e.type === 'pore'), clear = (x, y, need) => inside(x, y) >= need && doors.every(d => Math.hypot(d.x - x, d.y - y) > d.r + need);
    const ceiling = (x) => { let y = m; while (y < H / 2 && inside(x, y) < 40) y += 4; return y; };
    if (cleared >= 1) { for (const u of [0.14, 0.86]) if (clear(W * u, H * 0.46, 50)) out.push(...fireflyCloud(W * u, H * 0.46, 6, 44, { period: 2.6 })); said.push('fireflies followed you home'); }
    if (lit('lock')) {      // round the word, close above its letters and below them (each point pulled in from the rim if the room is tight)
      const cx = W / 2, cy = H * 0.30, rx = ww / 2 + 50, ry = ww / 28.8 * 3 + 34;
      const path = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => { const a = k / 10 * 6.2832 + Math.PI; let x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; for (let q = 0; q < 12 && inside(x, y) < 26; q++) { x += (cx - x) * 0.12; y += (cy - y) * 0.12; } return { x, y }; });
      out.push(...shoalOf('home', path[0].x, path[0].y, 7, { path })); said.push('a school of light followed you home');
    }
    if (lit('centrifuge')) { for (const u of [0.24, 0.76]) out.push({ type: 'pod', x: W * u, y: ceiling(W * u), a: Math.PI / 2, n: 5, regrow: 14 }); said.push('seed pods took root on the ceiling'); }
    if (lit('twin-cores')) {
      for (const [u, v] of [[0.36, 0.6], [0.64, 0.6]]) if (clear(W * u, H * v, 30)) out.push({ type: 'mote', kind: 'shy', x: W * u, y: H * v });
      out.push({ type: 'mote', kind: 'shy', x: W / 2, y: ceiling(W / 2) + 8 });
      for (const u of [0.22, 0.5, 0.78]) if (clear(W * u, H * 0.66, 30)) out.push({ type: 'mote', kind: 'drift', x: W * u, y: H * 0.66, value: 2 });
      said.push('shy sparks moved in');
    }
    if (lit('heart')) { out.push(...fireflyCloud(W / 2, H * 0.5, 12, Math.min(W, H) * 0.42, { period: 1.8, value: 2 }).filter(f => clear(f.x, f.y, 26))); said.push('the deep sent its fireflies after you'); }
    for (const e of out) e.home = true;
    return out;
  }
  wordEaten() {
    this.wordDone = true; const app = this.app, W = app.world, F = W.player && W.player.focus; if (!F || !F.alive) return;
    F.crown.joy(); F.excite = 1; W.flash = 0.7; W.hitStop = 0.12;
    W.fx.ring(F.B.cx, F.B.cy, [1, 0.86, 0.62], Math.max(W.spec.W, W.spec.H) * 0.55, 1.7, { a: 0.55, w: 3.2 }); W.fx.ring(F.B.cx, F.B.cy, [1, 0.95, 0.85], F.B.r * 3.2, 0.8, { a: 0.8 });
    W.fx.burst(F.B.cx, F.B.cy, 34, [1, 0.9, 0.7], 280, { life: 1.3, size: 2.8 });
    if (app.sound.ready) app.sound.bloom(); app.haptics && app.haptics.fuse && app.haptics.fuse();
    const door = W.ents.find(e => e.d.type === 'pore' && e.d.dest === 'odyssey'); if (!door) return;
    const dx = door.x - F.B.cx, dy = door.y - F.B.cy, L = Math.hypot(dx, dy), n = Math.max(4, Math.round(L / 64)); if (L < F.B.r + door.r + 40) return;
    for (let k = 1; k < n; k++) { const u = (F.B.r + 26 + (L - F.B.r - door.r - 50) * (k - 1) / Math.max(1, n - 2)) / L; W.spawn({ type: 'mote', x: F.B.cx + dx * u, y: F.B.cy + dy * u, value: 1, free: true, delay: 0.35 + k * 0.08, col: [1, 0.92, 0.74] }); }
  }
  onEvent(e) { if (!this.awake && (e.type === 'press' || e.type === 'key')) { this.wake(); return e.type === 'press'; } return false; }
  poreReady(p) { const d = this.dests.find(q => q.id === p.d.dest); return this.awake && d && d.open && (this.app.save.stars() > 0 || this.app.world.stats.motes >= 6 || p.d.dest !== 'odyssey'); }
  poreProgress(p) { const d = this.dests.find(q => q.id === p.d.dest); if (!d || !d.open) return 0; return p.d.dest === 'odyssey' && !this.app.save.stars() ? Math.min(1, this.app.world.stats.motes / 6) : 1; }
  complete(p) {
    const app = this.app, id = p.d.dest; const W = app.world;
    W.fx.ring(p.x, p.y, p.col, 240, 0.8); app.sound.portal();
    const mass = Math.min(60, W.player.mass);
    setTimeout(() => { if (app.mode !== this) return; if (id === 'odyssey') app.setMode(new Odyssey(app, this.next, { mass })); else { const d = this.dests.find(q => q.id === id); if (d && d.start) d.start(app, { mass }); } }, 450);
  }
  frame(dt) {
    const app = this.app, W = app.world, R = app.R; this.t += dt;
    if (!this.awake && app.input.any && app.input.device === 'mouse' && app.input.mouse.inside && this.t > 0.6 && app.state === 'play') this.wake();
    if (app.state !== 'play') { app.hud.setLabels([]); return; }
    const labels = [];
    // every door wears its name; only the one you are nearest says more (six captions side by side ran into one another)
    const F = W.player && W.player.focus; let near = null, nd = 1e9; if (F) for (const e of W.ents) if (e.d.type === 'pore') { const q = Math.hypot(e.x - F.B.cx, e.y - F.B.cy); if (q < nd) { nd = q; near = e; } }
    const solo = this.dests.length === 1;
    for (const e of W.ents) { if (e.d.type !== 'pore') continue; const d = this.dests.find(q => q.id === e.d.dest); if (!d) continue; const [x, y] = R.worldToCss(e.x, e.y + e.r + 16); const say = solo || e === near && nd < 230; labels.push({ x, y, html: `${d.name}<small>${d.open ? d.sub || '' : d.lock || 'locked'}</small>`, cls: (d.open ? '' : 'locked') + (say ? ' near' : '') }); }
    app.hud.setLabels(labels);
  }
}
