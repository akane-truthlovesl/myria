// ─────────────────────────────────────────────────────────────────────────────
//  MYRIA — boot & app flow
// ─────────────────────────────────────────────────────────────────────────────
import { Game } from './game/game.js';
import { HUD } from './ui/hud.js';
import { OdysseyMode } from './modes/odyssey.js';
import { TitleMode } from './modes/title.js';
import { CHAMBERS } from './levels/odyssey.js';
import { sound } from './audio/audio.js';
import { save } from './game/save.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const hud = new HUD(document.getElementById('ui'));
let G;
try { G = new Game(canvas, hud); }
catch (err) {
  document.getElementById('ui').innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px;letter-spacing:.15em;line-height:1.8">MYRIA needs WebGL2.<br><small style="opacity:.6">${err.message}</small></div>`;
  throw err;
}

// first touch awakens sound (and the creature)
const wake = () => { sound.init(); };
window.addEventListener('pointerdown', wake, { once: false });
window.addEventListener('keydown', wake, { once: false });

const app = {
  G,
  setMode(m) { if (G.mode && G.mode.exit) G.mode.exit(); G.hud.closeMenu(); G.hud.hideCard(); G.hud.clearHints(); G.paused = false; G.mode = m; if (m.enter) m.enter(); },
  startOdyssey(i) { this.setMode(new OdysseyMode(G, Math.max(0, Math.min(CHAMBERS.length - 1, i)), this)); },
  chamberMap() {
    G.paused = true;
    const beads = CHAMBERS.map((c, i) => {
      const r = save.chamber(c.id);
      const unlocked = i === 0 || save.chamber(CHAMBERS[i - 1].id) || params.has('all');
      const st = r ? r.stars.map(s => s ? '★' : '☆').join('') : '';
      return `<div class="bead ${unlocked ? '' : 'locked'} ${unlocked && !r ? 'next' : ''}" data-i="${i}"><span class="no">${i + 1}</span>${c.name}<span class="st">${st}</span></div>`;
    }).join('');
    G.hud.openMenu('Chambers', [{ label: 'Back', fn: () => { G.hud.closeMenu(); G.paused = false; } }], `${save.starsTotal()} ★ gathered`);
    const panel = G.hud.menu.querySelector('.panel');
    const map = document.createElement('div'); map.className = 'map'; map.innerHTML = beads;
    panel.insertBefore(map, panel.querySelector('.m-items'));
    map.querySelectorAll('.bead').forEach(b => b.onclick = (e) => { e.stopPropagation(); G.hud.closeMenu(); G.paused = false; this.startOdyssey(+b.dataset.i); });
  },
  hub(intro = false) { this.setMode(new TitleMode(G, this, { skipIntro: !intro })); },
  continueOdyssey() {
    let i = 0; while (i < CHAMBERS.length - 1 && save.chamber(CHAMBERS[i].id)) i++;
    this.startOdyssey(i);
  },
  // modes live in their own modules: ./modes/<name>.js exporting `Mode` (class (G, app, opts))
  async startMode(name, opts = {}) {
    try {
      const m = await import(`./modes/${name}.js`);
      this.setMode(new m.Mode(G, this, opts));
    } catch (err) {
      console.error(err);
      G.hud.toast(`${name} is still forming`, '◌');
      this.hub();
    }
  },
  startBloom(opts) { return this.startMode('bloom', opts); },
  startPool(opts) { return this.startMode('pool', opts); },
  startDuet(opts) { return this.startMode('duet', opts); },
};
window.__app = app; window.__G = G;

const q = save.get('quality', null); if (q !== null) G.R.setQuality(q);
if (save.get('muted', false)) sound.setMuted(true);
const lvl = params.get('level');
if (params.get('zoom')) G.zoomMul = +params.get('zoom');
if (params.get('mode')) app.startMode(params.get('mode'));
else if (lvl) app.startOdyssey(+lvl); else app.hub(!params.has('hub'));

// ── loop ───────────────────────────────────────────────────────────────────
const turbo = +(params.get('turbo') || 0);
let last = performance.now();
window.__stats = G.stats;
// adaptive resolution: keep motion silky on modest hardware (never touches physics/input)
const perf = { ema: 1 / 60, slow: 0, fast: 0 };
function adapt(dt) {
  if (turbo || document.hidden || dt > 0.25) return;
  perf.ema += (dt - perf.ema) * 0.05;
  const R = G.R;
  if (perf.ema > 1 / 44) { perf.slow += dt; perf.fast = 0; } else if (perf.ema < 1 / 57) { perf.fast += dt; perf.slow = 0; } else { perf.slow = 0; perf.fast = 0; }
  if (perf.slow > 1.5 && R.scale > 0.55) { R.scale = Math.max(0.55, R.scale - 0.1); R.resize(true); perf.slow = 0; perf.ema = 1 / 60; }
  if (perf.fast > 6 && R.scale < 1) { R.scale = Math.min(1, R.scale + 0.1); R.resize(true); perf.fast = 0; }
}
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  if (turbo) { for (let k = 0; k < turbo; k++) G.frame(1 / 60, k === turbo - 1); }
  else { G.frame(Math.min(0.05, dt)); adapt(dt); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode && G.mode.pause && !G.paused) G.mode.pause(); });
