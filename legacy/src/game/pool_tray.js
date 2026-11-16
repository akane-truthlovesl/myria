// ─────────────────────────────────────────────────────────────────────────────
//  Kneading Pool — the tool tray. Hidden until summoned; one quiet droplet
//  button at the corner. Fluids pour, contraptions drop, the world tilts.
// ─────────────────────────────────────────────────────────────────────────────
import { MAT, MATS } from '../engine/materials.js';

const CSS = `
.kp-root{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));pointer-events:none;display:flex;align-items:flex-end;gap:10px;z-index:3}
.kp-toggle{pointer-events:auto;width:48px;height:48px;border-radius:50%;border:1px solid rgba(205,190,255,.28);background:radial-gradient(circle at 35% 30%,rgba(120,100,200,.35),rgba(16,10,34,.55));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f1ebff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .4s;box-shadow:0 0 18px rgba(170,140,255,.18);flex:0 0 auto}
.kp-toggle:hover{box-shadow:0 0 26px rgba(190,160,255,.35)}
.kp-toggle.open{transform:rotate(45deg)}
.kp-toggle.beckon{animation:kpbeckon 2.2s ease-in-out infinite}
@keyframes kpbeckon{0%,100%{box-shadow:0 0 14px rgba(170,140,255,.18)}50%{box-shadow:0 0 34px rgba(220,190,255,.6)}}
.kp-panel{pointer-events:auto;display:flex;flex-direction:column;gap:7px;padding:11px 13px 9px;border-radius:22px;background:linear-gradient(160deg,rgba(34,24,66,.55),rgba(12,8,26,.66));border:1px solid rgba(195,175,255,.17);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 18px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05);transform-origin:left bottom;transition:opacity .35s,transform .5s cubic-bezier(.2,.8,.2,1)}
.kp-panel.closed{opacity:0;transform:translateY(12px) scale(.92);pointer-events:none}
.kp-row{display:flex;gap:6px;flex-wrap:wrap;max-width:min(470px,calc(100vw - 96px))}
.kp-sep{width:1px;background:rgba(200,185,255,.14);margin:4px 2px}
.kp-btn{width:38px;height:38px;border-radius:50%;border:1px solid rgba(205,190,255,.13);background:rgba(170,150,255,.05);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;color:rgba(236,230,255,.86);transition:background .2s,border-color .2s,transform .15s,box-shadow .25s,opacity .3s;padding:0;flex:0 0 auto}
.kp-btn:hover{background:rgba(170,150,255,.15);transform:translateY(-1px)}
.kp-btn:active{transform:scale(.93)}
.kp-btn.on{border-color:rgba(255,222,190,.75);box-shadow:0 0 16px rgba(255,200,150,.35),inset 0 0 10px rgba(255,210,170,.12);background:rgba(255,205,160,.10)}
.kp-btn.full{opacity:.35}
.kp-btn svg{width:20px;height:20px;overflow:visible}
.kp-drop{width:15px;height:15px;border-radius:50% 50% 50% 0;transform:rotate(-45deg) translate(1px,-1px)}
.kp-label{font-size:9.5px;letter-spacing:.32em;text-indent:.32em;text-transform:uppercase;color:rgba(232,222,255,.55);text-align:center;min-height:12px;margin-top:1px;transition:color .3s}
.kp-hint{position:absolute;left:0;top:0;pointer-events:none;opacity:0;transition:opacity .6s;z-index:2}
.kp-hint .kp-f{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:1.5px solid rgba(235,225,255,.85);background:radial-gradient(circle,rgba(255,255,255,.5),rgba(255,255,255,0) 70%);box-shadow:0 0 18px rgba(200,170,255,.6);animation:kpstretch 2.6s cubic-bezier(.45,.05,.3,1) infinite}
.kp-hint .kp-f.m{border-radius:9px 9px 12px 12px;width:20px;height:28px;left:-10px}
@keyframes kpstretch{0%{transform:translate(0,0) scale(1);opacity:0}12%{opacity:1;transform:translate(0,0) scale(.82)}62%{transform:translate(70px,-46px) scale(.82);opacity:1}78%{transform:translate(70px,-46px) scale(1);opacity:.2}100%{opacity:0;transform:translate(70px,-46px)}}
`;

const ICON = {
  hand: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1" opacity=".25"/></svg>',
  blade: '<svg viewBox="0 0 24 24"><path d="M4 20 L20 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 9 A8 8 0 0 1 9 6" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M18 15 A8 8 0 0 1 15 18" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/></svg>',
  bumper: '<svg viewBox="0 0 24 24"><path d="M3 15 Q12 21 21 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 12 V4 M9 7 L12 4 L15 7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".7"/></svg>',
  magnet: '<svg viewBox="0 0 24 24"><path d="M6 4 V12 A6 6 0 0 0 18 12 V4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="butt"/><path d="M4.5 4 H7.5 M16.5 4 H19.5" stroke="currentColor" stroke-width="3" opacity=".55"/></svg>',
  singularity: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#05030a" stroke="currentColor" stroke-width="1.3"/><path d="M12 3 A9 9 0 0 1 21 12" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".7"/><path d="M12 21 A9 9 0 0 1 3 12" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".7"/></svg>',
  geyser: '<svg viewBox="0 0 24 24"><path d="M8 20 Q6 14 8 9 Q10 5 8 3 M12 20 Q10 13 12 8 Q14 4 12 2 M16 20 Q14 14 16 9 Q18 5 16 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  grinder: '<svg viewBox="0 0 24 24"><path d="M12 2 L13.6 5.2 L17 4.2 L17.3 7.7 L20.8 8.6 L19.2 11.8 L21.6 14.4 L18.4 15.9 L18.6 19.5 L15.1 19.2 L13.6 22.4 L11.1 19.9 L8 21.6 L7.1 18.2 L3.6 17.6 L5 14.4 L2.4 12 L5.2 10 L4.3 6.6 L7.8 6.4 L8.9 3.1 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity=".7"/></svg>',
  current: '<svg viewBox="0 0 24 24"><path d="M3 8 Q7 5 11 8 T19 8 M15 5 L19 8 L15 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 16 Q7 13 11 16 T19 16 M15 13 L19 16 L15 19" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/></svg>',
  peg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="currentColor" opacity=".55"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9 9.5 A4 4 0 0 1 12 8" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8"/></svg>',
  eraser: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.8 17.2 L17.2 6.8" stroke="currentColor" stroke-width="1.4"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 3 V19 M6 13 L12 19 L18 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zero: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  swirl: '<svg viewBox="0 0 24 24"><path d="M12 12 m0 -1.5 a1.5 1.5 0 1 1 -1.5 1.5 a4 4 0 0 1 4 -4 a6 6 0 0 1 6 6 a8.5 8.5 0 0 1 -8.5 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 21 V5 M6 11 L12 5 L18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  swell: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 10 A5 5 0 0 1 11 6.6" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".8"/><circle cx="15.5" cy="15" r="1.3" fill="currentColor" opacity=".6"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M5 12 A7 7 0 1 0 8 6.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8.5 2.5 L8 6.6 L12 7.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5 V19 M5 12 H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

export const FLUIDS = [
  { id: 'lumen', mat: MAT.LUMEN, name: 'lumen' },
  { id: 'ember', mat: MAT.EMBER, name: 'ember' },
  { id: 'resin', mat: MAT.RESIN, name: 'resin' },
  { id: 'bastion', mat: MAT.BASTION, name: 'bastion' },
  { id: 'oil', mat: MAT.OIL, name: 'oil' },
  { id: 'silver', mat: MAT.SILVER, name: 'quicksilver' },
  { id: 'ferro', mat: MAT.FERRO, name: 'ferro' },
  { id: 'foam', mat: MAT.FOAM, name: 'foam' },
];
export const THINGS = [
  { id: 'peg', name: 'peg' }, { id: 'bumper', name: 'bumper' }, { id: 'blade', name: 'blade' }, { id: 'grinder', name: 'grinder' },
  { id: 'magnet', name: 'magnet' }, { id: 'singularity', name: 'singularity' }, { id: 'geyser', name: 'geyser' }, { id: 'current', name: 'current' },
];

function cssColor(m) {
  const d = MATS[m]; const e = d.emit, a = d.absorb;
  // what a thick drop looks like: emission filtered by absorption
  const c = e.map((v, i) => Math.min(255, Math.round(255 * Math.pow(v * Math.exp(-a[i] * 0.9), 0.75))));
  const rim = e.map(v => Math.round(255 * Math.min(1, v * 0.9 + 0.1)));
  return { fill: `rgb(${c.join(',')})`, rim: `rgb(${rim.join(',')})`, metal: d.metal };
}

export class Tray {
  constructor(root, cb) {
    this.cb = cb;
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const el = this.el = document.createElement('div'); el.className = 'kp-root';
    el.innerHTML = `<button class="kp-toggle beckon" tabindex="-1" aria-label="tools">${ICON.plus}</button>
      <div class="kp-panel closed">
        <div class="kp-row kp-fluids"></div>
        <div class="kp-row kp-things"></div>
        <div class="kp-row kp-world"></div>
        <div class="kp-label">&nbsp;</div>
      </div>`;
    root.appendChild(el);
    this.panel = el.querySelector('.kp-panel');
    this.toggleBtn = el.querySelector('.kp-toggle');
    this.label = el.querySelector('.kp-label');
    this.btns = new Map();
    const mk = (row, id, html, name, onDown, onUp) => {
      const b = document.createElement('button'); b.className = 'kp-btn'; b.tabIndex = -1; b.innerHTML = html; b.dataset.id = id; b.setAttribute('aria-label', name);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); onDown && onDown(e); this.say(name); });
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); onUp && onUp(e); });
      b.addEventListener('pointerleave', (e) => { onUp && onUp(e); });
      b.addEventListener('pointerenter', () => this.say(name));
      row.appendChild(b); this.btns.set(id, b); return b;
    };
    const rowF = el.querySelector('.kp-fluids'), rowT = el.querySelector('.kp-things'), rowW = el.querySelector('.kp-world');
    mk(rowF, 'hand', ICON.hand, 'hand · knead', () => cb.tool('hand'));
    for (const f of FLUIDS) {
      const c = cssColor(f.mat);
      const html = `<span class="kp-drop" style="background:radial-gradient(circle at 30% 30%,${c.rim},${c.fill} 70%);box-shadow:0 0 10px ${c.rim}${c.metal > 0.5 ? ',inset 0 0 4px #fff' : ''}"></span>`;
      mk(rowF, f.id, html, `pour · ${f.name}`, () => cb.tool(f.id));
    }
    for (const t of THINGS) mk(rowT, t.id, ICON[t.id], `place · ${t.name}`, () => cb.tool(t.id));
    mk(rowT, 'eraser', ICON.eraser, 'erase', () => cb.tool('eraser'));
    this.gravBtn = mk(rowW, 'gravity', ICON.down, 'gravity', () => cb.gravity());
    mk(rowW, 'swell', ICON.swell, 'swell · hold', () => cb.swell(true), () => cb.swell(false));
    mk(rowW, 'clear', ICON.clear, 'clear the pool', () => cb.clear());
    this.toggleBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.toggle(); });
    this.open = false;
    this.setTool('hand');
  }
  say(s) { this.label.textContent = s; clearTimeout(this._lt); this._lt = setTimeout(() => { this.label.textContent = this.toolName || ' '; }, 1600); }
  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.panel.classList.toggle('closed', !this.open);
    this.toggleBtn.classList.toggle('open', this.open);
    this.toggleBtn.classList.remove('beckon');
    this.cb.toggled && this.cb.toggled(this.open);
  }
  beckon(on) { if (!this.open) this.toggleBtn.classList.toggle('beckon', on); }
  setTool(id) {
    for (const [k, b] of this.btns) if (k !== 'gravity' && k !== 'swell' && k !== 'clear') b.classList.toggle('on', k === id);
    const f = FLUIDS.find(x => x.id === id), t = THINGS.find(x => x.id === id);
    this.toolName = id === 'hand' ? 'hand · knead' : f ? `pour · ${f.name}` : t ? `place · ${t.name}` : id === 'eraser' ? 'erase' : id;
    this.label.textContent = this.toolName;
  }
  setGravity(mode) {
    this.gravBtn.innerHTML = ICON[mode] || ICON.down;
    this.say(mode === 'down' ? 'gravity · down' : mode === 'zero' ? 'gravity · weightless' : mode === 'swirl' ? 'gravity · whirlpool' : 'gravity · rising');
  }
  setSwell(on) { const b = this.btns.get('swell'); if (b) b.classList.toggle('on', on); }
  setFull(full) { for (const f of FLUIDS) { const b = this.btns.get(f.id); if (b) b.classList.toggle('full', full); } }
  destroy() { this.el.remove(); this.style.remove(); }
}

export { ICON };
