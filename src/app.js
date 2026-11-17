// ─────────────────────────────────────────────────────────────────────────────
//  App — the browser shell: frame loop, intent → ctl, chamber transitions,
//  pause, adaptive resolution. Modes plug in as world listeners.
// ─────────────────────────────────────────────────────────────────────────────
import { Renderer } from './render/renderer.js';
import { World } from './world/world.js';
import { Input } from './core/input.js';
import { HUD } from './ui/hud.js';
import { sound } from './core/audio.js';
import { haptics } from './core/haptics.js';
import { save } from './core/save.js';
import { album } from './core/album.js';
import { smooth, ease } from './core/util.js';
import { Bot } from './core/bot.js';
import { skinFor } from './core/skins.js';

const STEP = 1 / 60;

import { Link } from './core/link.js';

export class App {
  constructor(canvas, uiRoot, params) {
    this.canvas = canvas; this.params = params; this.link = new Link(this);
    this.R = new Renderer(canvas);
    this.input = new Input(canvas);
    this.hud = new HUD(uiRoot);
    this.sound = sound; this.haptics = haptics; this.save = save;
    this.world = new World({ sound, haptics, overlay: (ov, R) => this._stick(ov, R), skin: () => skinFor(save).tint, moment: (c, s, o) => this.moment(c, s, o) });
    this.mode = null; this.paused = false; this.state = 'idle';
    this.acc = 0; this.t = 0; this.last = 0; this.frames = 0;
    this.pending = { darts: [], buds: [], cycle: 0, focusAt: null };
    this.ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false, darts: null, buds: null, cycle: 0, focusAt: null };
    this.trans = null; this.turbo = +(params.get('turbo') || 0); this.bot = params.has('bot');
    this.perf = { ema: 1 / 60, slow: 0, fast: 0, sim: 0, ren: 0 };
    if (params.get('scale')) this.R.scale = +params.get('scale');
    // how many pixels can this machine afford? measured, never assumed (and re-measured as the session goes)
    this.fixedPx = +(params.get('maxpx') || 0) > 1000;
    this.R.maxPixels = this.fixedPx ? +params.get('maxpx') : calibrate();
    this.basePx = this.R.maxPixels; this.smooth = !!save.get('smooth', false) || params.has('smooth');
    if (save.get('tilt', false) && typeof window.DeviceOrientationEvent !== 'undefined' && typeof window.DeviceOrientationEvent.requestPermission !== 'function') this.input.setTilt(true);      // (where a permission prompt is needed, it waits for the menu)
    this.wantPx = this.R.maxPixels; this.skip = 1; this.skipN = 0;
    this.R.resize(true);
    window.addEventListener('resize', () => { this._resizeT = performance.now(); });
    const wake = () => { sound.init(); if (save.get('muted', false)) sound.setMuted(true); };
    window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.paused && this.mode && this.mode.pausable !== false) this.pause(); });
  }

  // ── modes ─────────────────────────────────────────────────────────────
  setMode(m) { if (this.mode && this.mode.exit) this.mode.exit(); this.hud.closePanel(); this.hud.hideResult(); this.hud.setTop(null); this.hud.setLabels([]); this.hud.hint(''); if (this.paused) this.sound.duck && this.sound.duck(false); this.paused = false; this.mode = m;
    // The room on screen belongs to the mode that is leaving: until the new mode's own room is loaded (_load sets the listener) the world answers to nobody.
    // (Handing it to the new mode at once made a fresh dive read its not-yet-built room — "Dive again" threw every frame and never arrived — and let a new
    //  run be charged for the old run's death while the iris closed.)
    this.world.listener = null; m.enter(); }

  // ── chamber transitions ───────────────────────────────────────────────
  // close an iris on (wx,wy), load the next room, develop it in the dark (the mode may show a card), open on the spawn
  travel(spec, carry, o = {}) {
    const R = this.R; const from = o.from || (this.world.player && this.world.player.focus ? { x: this.world.player.focus.B.cx, y: this.world.player.focus.B.cy } : null);
    const first = this.state === 'idle' || !from;
    this.trans = { phase: first ? 'load' : 'out', t: 0, spec, carry, o, from, minDark: o.minDark ?? 0.25, dark: 0 };
    if (first) this._load();
    else { this.state = 'out'; this.sound.whoosh && this.sound.ready && this.sound.whoosh(); }
  }
  _load() {
    const T = this.trans; const spec = typeof T.spec === 'function' ? T.spec(this.R.fb.w / this.R.fb.h) : T.spec;
    const carry = typeof T.carry === 'function' ? T.carry(spec) : T.carry;
    this.world.load(spec, carry || {}); this.world.listener = this.mode;
    this.R.setRoom(this.world.roomView());
    T.phase = 'load'; this.state = 'load'; this.hud.setIris(0, 0, -1);
    if (T.o.onLoad) T.o.onLoad(this.world);
    // settle the newborn body before the curtain rises
    for (let k = 0; k < 20; k++) this.world.step(STEP, NOCTL);
    this.acc = 0;
  }
  _transition(dt) {
    const T = this.trans; if (!T) return;
    const R = this.R, hud = this.hud; T.t += dt;
    const far = Math.hypot(R.cssW, R.cssH);
    if (T.phase === 'out') {
      const k = Math.min(1, T.t / 0.55); const [cx, cy] = R.worldToCss(T.from.x, T.from.y);
      hud.setIris(cx, cy, far * (1 - ease.inCubic(k)) + 2);
      if (k >= 1) { hud.setIris(0, 0, -1); T.o.onDark && T.o.onDark(); this._load(); T.t = 0; }
    } else if (T.phase === 'load') {
      T.dark += dt; hud.setLoader(T.dark > 0.3 && !hud.result.classList.contains('on') && !hud.panelOpen);
      const done = R.develop(this.turbo ? 200 : 10);
      if (done && T.dark >= T.minDark && (!T.o.hold || T.o.hold())) {
        hud.setLoader(false); T.phase = 'in'; T.t = 0; this.state = 'in'; this.acc = 0;
        // the pointer is wherever the last door was: a new room must not set off after it. The creature waits for the hand to move.
        if (this.input.device === 'mouse') this.input.mouse.follow = false;
        { const F = this.world.player && this.world.player.focus, cl = hud.clear; cl.length = 0; if (F) { cl.push(R.worldToCss(F.B.cx, F.B.cy)); for (const e of this.world.ents) if (e.d.type === 'pore') cl.push(R.worldToCss(e.x, e.y)); } }
        T.o.onReveal && T.o.onReveal();
      }
    } else if (T.phase === 'in') {
      const k = Math.min(1, T.t / 0.7); const F = this.world.player && this.world.player.focus;
      const [cx, cy] = F ? R.worldToCss(F.B.cx, F.B.cy) : [R.cssW / 2, R.cssH / 2];
      hud.setIris(cx, cy, 30 + far * ease.outCubic(k));
      if (k >= 1) { hud.setIris(0, 0, null); this.trans = null; this.state = 'play'; }
    }
  }
  // the first backdrop tells us how fast this machine paints → choose an internal pixel budget it can afford

  // a result as a line of text for the clipboard (works from file:// too, via the old textarea trick)
  copyText(text) {
    const old = () => { try { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } catch (_) { /* nothing to be done */ } };
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(old); else old(); } catch (_) { old(); }
    this.sound.ui && this.sound.ui();
  }
  // the frame on the glass, as a PNG: every screenshot of this game should be worth keeping
  // a moment worth keeping (a trick found for the first time, a warden passed, a new size, the last room): a small picture of the
  // glass a breath later — once the effect has bloomed — with a line under it. `once` keys a moment that is only ever kept once.
  // The Atrium shows them as an album (core/album.js)
  moment(caption, sub = '', once = '') {
    if (once) { const seen = save.get('moments', []); if (seen.includes(once)) return; seen.push(once); save.set('moments', seen); }
    setTimeout(() => {
      try {
        if (typeof document === 'undefined' || document.hidden) return;
        const c = this.R.canvas, k = Math.min(400 / c.width, 300 / c.height), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
        const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, 0, 0, w, h);
        album.add({ src: o.toDataURL('image/jpeg', 0.76), caption, sub, t: Date.now() });
      } catch (_) { /* a locked-down browser: no picture, no harm */ }
    }, 380);
  }
  snapshot() {
    try {
      const c = this.R.canvas, name = ((this.world.spec && this.world.spec.name) || 'myria').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      c.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.download = `myria-${name}-${String(Date.now() % 1e6).padStart(6, '0')}.png`; a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
      this.sound.ui && this.sound.ui();
    } catch (_) { /* a locked-down browser: no picture, no harm */ }
  }
  pause() {
    if (this.paused || this.state !== 'play') return; this.paused = true; this.sound.duck && this.sound.duck(true);
    const m = this.mode, hud = this.hud;
    const items = [{ label: 'Resume', cls: 'pri', fn: () => this.resume() }];
    if (m && m.restart) items.push({ label: 'Restart chamber', fn: () => { this.resume(); m.restart(); } });
    if (m && m.pauseItems) items.push(...m.pauseItems());
    items.push([{ label: this.sound.muted ? 'Sound off' : 'Sound on', fn: (b) => { const mu = !this.sound.muted; this.sound.setMuted(mu); save.set('muted', mu); b.textContent = mu ? 'Sound off' : 'Sound on'; } },
      { label: 'Fullscreen', fn: () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else d.requestFullscreen && d.requestFullscreen().catch(() => {}); } }]);
    // comfort: tilt to steer (where the device can feel it) · smooth motion (a softer picture, sixty frames) or a sharp one
    const opts = [{ label: this.smooth ? 'Smooth' : 'Sharp', fn: (b) => { this.smooth = !this.smooth; save.set('smooth', this.smooth); this.perf.over = 0; if (!this.smooth) this.wantPx = this.basePx; b.textContent = this.smooth ? 'Smooth' : 'Sharp'; } }];
    if (this.input.tiltAvailable) opts.unshift({ label: this.input.tilt.on ? 'Tilt on' : 'Tilt off', fn: (b) => { const want = !this.input.tilt.on; this.input.setTilt(want).then((ok) => { save.set('tilt', ok); b.textContent = ok ? 'Tilt on' : want ? 'Tilt unavailable' : 'Tilt off'; }); } });
    items.push(opts);
    items.push({ label: 'Keep a picture', fn: (b) => { this.snapshot(); b.textContent = 'Kept ✓'; } });
    if (!m || m.isHub !== true) items.push({ label: 'Leave to the atrium', fn: () => { this.resume(); this.toHub(); } });
    hud.panel('Paused', m && m.pauseSub ? m.pauseSub() : '', items, (this.input.device === 'touch' ? CONTROLS_TOUCH_HTML : this.input.device === 'pad' ? CONTROLS_PAD_HTML : CONTROLS_HTML));
  }
  resume() { this.paused = false; this.sound.duck && this.sound.duck(false); this.hud.closePanel(); this.last = performance.now(); this.input.levelTilt(); }

  // ── intent → ctl ──────────────────────────────────────────────────────
  _events(evs) {
    const W = this.world, R = this.R, P = this.pending; const pl = W.player; const F = pl && pl.focus;
    for (const e of evs) {
      if (this.mode && this.mode.onEvent && this.mode.onEvent(e)) continue;
      if (e.type === 'pause') { if (this.paused) this.resume(); else this.pause(); continue; }
      if (this.paused || this.state !== 'play' || !F || !F.alive) continue;
      if (e.type === 'click' || e.type === 'tap') {
        const [wx, wy] = R.cssToWorld(e.x, e.y);
        let own = false; for (const O of pl.orgs) if (O.alive && Math.hypot(O.B.cx - wx, O.B.cy - wy) < O.B.r * 0.9 + (O === F ? 0 : 26)) { own = true; break; }
        if (own) P.focusAt = { x: wx, y: wy };
        else P.darts.push({ x: wx - F.B.cx, y: wy - F.B.cy, power: 0.9 + Math.min(1, (e.hold || 0) / 0.7) * 0.7 });
      } else if (e.type === 'dartDir') P.darts.push({ x: e.x, y: e.y, power: e.power });
      else if (e.type === 'dartKey') { const a = this.ctl.aim, pw = 0.9 + Math.min(1, (e.hold || 0) / 0.7) * 0.7; if (this.input.pointerSteers && a) P.darts.push({ x: a.x - F.B.cx, y: a.y - F.B.cy, power: pw }); else P.darts.push({ x: F.facing.x, y: F.facing.y, power: pw }); }
      else if (e.type === 'budAt') { const [wx, wy] = R.cssToWorld(e.x, e.y); P.buds.push({ x: wx, y: wy }); }
      else if (e.type === 'budKey') { const a = this.ctl.aim; if (this.input.pointerSteers && a) P.buds.push({ x: a.x, y: a.y }); else P.buds.push({ x: F.B.cx + F.facing.x * 200, y: F.B.cy + F.facing.y * 200 }); }
      else if (e.type === 'cycle') P.cycle = e.dir;
    }
  }
  _ctl(first) {
    const c = this.ctl, inp = this.input, W = this.world, R = this.R, P = this.pending;
    const F = W.player && W.player.focus;
    c.intent.x = 0; c.intent.y = 0; c.aim = null;
    if (F && F.alive && this.state === 'play') {
      const v = inp.vector();
      if (inp.device === 'mouse' && inp.mouse.inside) { const [wx, wy] = R.cssToWorld(inp.mouse.x, inp.mouse.y); c.aim = { x: wx, y: wy }; }
      if (v) { c.intent.x = v.x; c.intent.y = v.y; if (!c.aim && (v.x || v.y)) c.aim = { x: F.B.cx + v.x * 160, y: F.B.cy + v.y * 160 }; }
      else if (inp.pointerSteers && c.aim) {
        // the creature follows the pointer; resting the pointer on it lets it rest
        const dx = c.aim.x - F.B.cx, dy = c.aim.y - F.B.cy, d = Math.hypot(dx, dy) + 1e-3;
        const t = smooth(F.B.r * 0.45, F.B.r * 0.45 + 95, d);
        c.intent.x = dx / d * t; c.intent.y = dy / d * t;
      }
      if (inp.charge > 0.22) { c.intent.x *= 0.15; c.intent.y *= 0.15; F.coil = Math.min(1, (inp.charge - 0.22) / 0.6); } else F.coil = 0;
    }
    c.swell = inp.swell && this.state === 'play';
    if (this.bot && F && F.alive && this.state === 'play') this._bot(c, F);
    c.rally = (inp.rally || c.botRally) && this.state === 'play';
    c.darts = first && P.darts.length ? P.darts : null; c.buds = first && P.buds.length ? P.buds : null; c.cycle = first ? P.cycle : 0; c.focusAt = first ? P.focusAt : null;
    // hands on the gel (the Pool's kneading): fingers are hands, not a stick — the creature wills nothing while it is held
    if (inp.hands && inp.device === 'touch' && inp.pointers.size) { c.intent.x = 0; c.intent.y = 0; c.swell = false; c.rally = false; c.darts = null; c.buds = null; }
    return c;
  }

  _stick(ov, R) {
    const S = this.input.stick; if (!S.active || this.state !== 'play') return;
    const [ax, ay] = R.cssToWorld(S.ax, S.ay), [kx, ky] = R.cssToWorld(S.kx, S.ky); const r = this.input.stickRadius / (R.view.z / R.pxScale);
    ov.ring(ax, ay, r, 1.2 / R.view.z * R.pxScale, [0.75, 0.9, 1], 0.35); ov.glow(kx, ky, r * 0.5, [0.85, 0.95, 1], 0.45);
  }
  // autopilot (?bot): the same Bot that proves the chambers in headless playtests — soak tests, attract mode
  _bot(c, F) { const W = this.world; if (!this.botAI || this.botAI.spec !== W.spec) { this.botAI = new Bot(W, { greed: 1 }); this.botAI.spec = W.spec; } this.botAI.step(1 / 60, c); c.botRally = c.rally; if (c.darts) { this.pending.darts.push(...c.darts); } if (c.buds) this.pending.buds.push(...c.buds); }

  // ── frame ─────────────────────────────────────────────────────────────
  frame(now) {
    const raw = (now - this.last) / 1000; this.last = now;
    const dt = Math.min(0.1, Math.max(0, raw)); this.t += dt; this.frames++;
    if (this._resizeT && now - this._resizeT > 180) { this._resizeT = 0; if (this.R.resize()) { /* room is re-developed synchronously by the renderer */ } }
    // a guest on a Link only watches the host's picture and lends it a hand: its own world stands still underneath (core/link.js)
    if (this.linkGuest) { this.input.poll(dt); return; }
    const evs = this.input.poll(dt);
    this._events(evs);
    const live = (this.state === 'play' || this.state === 'in' || this.state === 'out') && !this.paused;
    const t0 = performance.now();
    if (live) {
      const W = this.world; let ts = 1; if (W.hitStop > 0) { W.hitStop -= dt; ts = 0.12; }            // a held breath on impact (cleave, film, devour)
      this.acc += this.turbo ? STEP * this.turbo : dt * ts;
      let n = 0; const maxN = this.turbo || 3;
      while (this.acc >= STEP && n < maxN) { this.world.step(STEP, this._ctl(n === 0)); this.acc -= STEP; n++; }
      if (n === maxN) this.acc = 0;
      if (n > 0) { const P = this.pending; P.darts = []; P.buds = []; P.cycle = 0; P.focusAt = null; }
    }
    const t1 = performance.now();
    this._transition(dt);
    const draw = this.skip === 1 || (++this.skipN % this.skip) === 0 || this.state !== 'play';
    if (draw && !this.R.developing && this.state !== 'idle' && this.state !== 'load') this.world.render(this.R);
    const t2 = performance.now();
    // impacts nudge the whole plate for a few frames (the only time the canvas itself moves)
    const sh = this.world.shake; if (sh > 0.04 && this.state === 'play' && !this.paused) { this.canvas.style.transform = `translate(${((Math.random() - 0.5) * sh * 9).toFixed(1)}px,${((Math.random() - 0.5) * sh * 9).toFixed(1)}px)`; this._shook = true; } else if (this._shook) { this.canvas.style.transform = ''; this._shook = false; }
    this.hud.setFlash(this.world.flash);
    if (this.mode && this.mode.frame) this.mode.frame(dt);
    // what the words on the glass must keep clear of: the creature and the way out
    if ((this.frames & 7) === 0) { const W = this.world, F = W.player && W.player.focus, cl = this.hud.clear; cl.length = 0;
      if (F && F.alive && this.state !== 'idle') { cl.push(this.R.worldToCss(F.B.cx, F.B.cy)); for (const e of W.ents) if (e.d.type === 'pore' && !e.taken) cl.push(this.R.worldToCss(e.x, e.y)); }
      this.hud.layout(); }
    const p = this.perf; p.sim += (t1 - t0 - p.sim) * 0.1; if (draw) p.ren += (t2 - t1 - p.ren) * 0.1;
    if (this.state === 'play' && !this.paused && raw < 0.25) this._adapt(raw);
  }
  // keep motion steady on modest hardware:
  //  · pacing — if a frame's work runs long, draw every second refresh (the simulation keeps real time)
  //  · budget — and ask for fewer (or more) internal pixels from the next chamber on
  _adapt(dt) {
    const p = this.perf; p.ema += (dt - p.ema) * 0.04;
    const work = p.ren + p.sim * (this.skip === 2 ? 2 : 1);
    const soft = this.smooth && !this.fixedPx && this.R.fb.w * this.R.fb.h > 0.40e6 * 1.08;      // (smooth: shrink first, see below)
    if (this.skip === 1 && !soft && (work > 9.5 || p.ema > 1 / 44)) { p.slow += dt; if (p.slow > 1.2) { this.skip = 2; p.slow = 0; p.fast = 0; } }
    else if (this.skip === 2 && work < 5.2) { p.fast += dt; if (p.fast > 5) { this.skip = 1; p.fast = 0; p.slow = 0; p.ema = 1 / 60; } }
    else { p.slow = Math.max(0, p.slow - dt); p.fast = Math.max(0, p.fast - dt); }
    if (this.fixedPx) return;
    // "smooth" preference: hold sixty frames by making the picture softer, now (behind a blink), down to a floor — half-rate pacing only if even that is not enough
    if (this.smooth) {
      const cur0 = this.R.fb.w * this.R.fb.h, w60 = p.ren + p.sim, FLOOR = 0.40e6;
      if ((w60 > 9 || this.skip === 2) && cur0 > FLOOR * 1.08) { p.over = (p.over || 0) + dt; if (p.over > 1.4 && this.t - (p.lastRe || -99) > 4) { p.over = 0; p.lastRe = this.t; this.skip = 1; p.slow = 0; this._rebudget(Math.max(FLOOR, cur0 * Math.max(0.5, Math.min(0.85, 7.5 / w60)))); return; } }
      else p.over = Math.max(0, (p.over || 0) - dt);
    }
    // far over budget for a while → do not make the player wait for the next chamber: re-develop this one smaller, behind a blink
    if (work > 24) { p.hard = (p.hard || 0) + dt; if (p.hard > 2.2 && this.R.fb.w * this.R.fb.h > 0.6e6 && this.t - (p.lastRe || -99) > 8) { p.hard = 0; p.lastRe = this.t; this._rebudget(Math.max(0.52e6, this.R.fb.w * this.R.fb.h * (work > 40 ? 0.55 : 0.7))); return; } } else p.hard = Math.max(0, (p.hard || 0) - dt * 0.5);
    const cur = this.R.fb.w * this.R.fb.h; p.acc = (p.acc || 0) + dt;
    if (p.acc > 6) { p.acc = 0; if (work > 13) this.wantPx = Math.max(0.4e6, cur * 0.75); else if (work < 4 && this.skip === 1) this.wantPx = Math.min(4.2e6, cur * 1.3); }
  }
  _rebudget(px) {
    const R = this.R; this.wantPx = px; R.maxPixels = px; this.hud.setIris(0, 0, -1); this.state = 'load';
    const room = this.world.roomView(); R.room = null; R.resize(true); R.setRoom(room);
    this.trans = { phase: 'load', t: 0, dark: 0, minDark: 0, o: {}, from: null }; this.perf.ren = 6; this.perf.sim = 1; this.perf.ema = 1 / 60;
  }
  // applied while the screen is dark, so the change is never seen
  applyBudget() { if (!this.fixedPx && this.wantPx && Math.abs(this.wantPx - this.R.maxPixels) / this.R.maxPixels > 0.1) { this.R.maxPixels = this.wantPx; this.R.room = null; this.R.resize(true); } }

  start(mode) {
    this.setMode(mode);
    this.last = performance.now();
    const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
const NOCTL = { intent: null, aim: null, rally: false };
// a few milliseconds of representative arithmetic → an internal pixel budget (≈0.9 MP on a slow shared vCPU, 4 MP on a desktop)
function calibrate() {
  const a = new Float32Array(1 << 14); let best = 1e9;
  for (let rep = 0; rep < 4; rep++) { const t0 = performance.now(); let s = 0; for (let k = 0; k < 6; k++) for (let i = 0; i < a.length; i++) { a[i] = a[i] * 0.99 + Math.sqrt(i + k); s += a[i]; } const ns = (performance.now() - t0) * 1e6 / (6 * a.length); if (ns < best && s > 0) best = ns; }
  return Math.max(0.5e6, Math.min(4.2e6, 0.9e6 * 16 / Math.max(2, best)));
}
// the same card for a thumb, and for a pad: every device is told its own verbs (and only on the pause card — play itself is wordless)
const CONTROLS_TOUCH_HTML = `<div class="sub" style="line-height:2.1;margin:6px 0 2px">
  drag anywhere — it follows &nbsp;·&nbsp; <b>tap</b> dart &nbsp;·&nbsp; <b>hard flick</b> lance<br>
  second finger — <b>tap</b> bud &nbsp;·&nbsp; <b>hold</b> swell &nbsp;·&nbsp; <b>pinch</b> rally &nbsp;·&nbsp; tap a sibling to swap</div>`;
const CONTROLS_PAD_HTML = `<div class="sub" style="line-height:2.1;margin:6px 0 2px">
  left stick — it follows &nbsp; <span class="key">A</span> dart (hold: lance) &nbsp; <span class="key">X</span> bud<br>
  <span class="key">Y</span> swell &nbsp; <span class="key">B</span> rally &nbsp; <span class="key">LB</span><span class="key">RB</span> swap</div>`;
const CONTROLS_HTML = `<div class="sub" style="line-height:2.1;margin:6px 0 2px">
  <span class="mouse-ic m"></span> move the pointer — it follows &nbsp; <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span><br>
  <span class="mouse-ic"></span> dart &nbsp;<span class="key">Space</span> &nbsp;&nbsp; <span class="mouse-ic r"></span> bud &nbsp;<span class="key">E</span> &nbsp;&nbsp; rally <span class="key">Q</span> &nbsp;&nbsp; swell <span class="key">F</span> &nbsp;&nbsp; swap <span class="key">Tab</span></div>`;
