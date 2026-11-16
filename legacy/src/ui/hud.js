// ─────────────────────────────────────────────────────────────────────────────
//  HUD — almost nothing on screen. Text only where words truly help; hints are
//  wordless ghost gestures that appear only when you stall.
// ─────────────────────────────────────────────────────────────────────────────

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class HUD {
  constructor(root) {
    this.root = root;
    this.G = null;
    root.innerHTML = '';
    this.titleEl = el('div', 'h-title'); root.appendChild(this.titleEl);
    this.counter = el('div', 'h-counter'); root.appendChild(this.counter);
    this.hints = el('div', 'h-hints'); root.appendChild(this.hints);
    this.toasts = el('div', 'h-toasts'); root.appendChild(this.toasts);
    this.menu = el('div', 'h-menu hidden'); root.appendChild(this.menu);
    this.card = el('div', 'h-card hidden'); root.appendChild(this.card);
    this.corner = el('div', 'h-corner'); root.appendChild(this.corner);
    this.hintEls = new Map();
    this.counterT = 0;
    this.lastCount = '';
    this.titleT = 0;
  }

  // ── chamber title ────────────────────────────────────────────────────
  showTitle(name, sub = '', dur = 3.2) {
    this.titleEl.innerHTML = `<div class="t-name">${name}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}`;
    this.titleEl.classList.remove('out'); this.titleEl.classList.add('in');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { this.titleEl.classList.remove('in'); this.titleEl.classList.add('out'); }, dur * 1000);
  }

  // ── counter: light & prisms (fades when unchanged) ──────────────────
  setCounter(motes, total, prisms, prismTotal, extra = '') {
    const key = `${motes}/${total}/${prisms}/${extra}`;
    if (key !== this.lastCount) {
      this.lastCount = key;
      let p = '';
      for (let i = 0; i < prismTotal; i++) p += `<span class="pr ${i < prisms ? 'on' : ''}"></span>`;
      this.counter.innerHTML = `<span class="mt"><i></i>${motes}<small>/${total}</small></span>${prismTotal ? `<span class="prs">${p}</span>` : ''}${extra ? `<span class="ex">${extra}</span>` : ''}`;
      this.counter.classList.add('lit');
      clearTimeout(this._ct);
      this._ct = setTimeout(() => this.counter.classList.remove('lit'), 2600);
    }
  }
  hideCounter() { this.counter.innerHTML = ''; this.lastCount = ''; }

  // ── wordless hints ───────────────────────────────────────────────────
  hint(h, alpha) {
    let e = this.hintEls.get(h);
    if (!e) {
      e = el('div', 'h-hint');
      this.hints.appendChild(e); this.hintEls.set(h, e);
    }
    const dev = this.G.input.device;
    const k = h.kind;
    const key = (s) => `<span class="key">${s}</span>`;
    let html = '';
    const touch = dev === 'touch';
    if (k === 'drag') html = touch ? `<div class="g-finger g-drag"></div>` : dev === 'mouse' ? `<div class="g-finger g-drag mouse"></div><div class="alt">${key('W')}${key('A')}${key('S')}${key('D')}</div>` : `${key('W')}${key('A')}${key('S')}${key('D')}`;
    else if (k === 'flick') html = touch || dev === 'mouse' ? `<div class="g-finger g-flick ${touch ? '' : 'mouse'}"></div>${touch ? '' : `<div class="alt">${key('Space')}</div>`}` : key('Space');
    else if (k === 'climb') html = touch || dev === 'mouse' ? `<div class="g-finger g-push ${touch ? '' : 'mouse'}"></div>` : `${key('→')}<span class="glyph">⟰</span>`;
    else if (k === 'bud') html = touch ? `<div class="g-two"><div class="g-finger hold"></div><div class="g-finger g-tap"></div></div>` : dev === 'mouse' ? `<div class="g-rmb"></div><div class="alt">${key('E')}</div>` : key('E');
    else if (k === 'swap') html = touch || dev === 'mouse' ? `<div class="g-finger g-tap ${touch ? '' : 'mouse'}"></div><div class="alt">${key('Tab')}</div>` : key('Tab');
    else if (k === 'rally') html = touch ? `<div class="g-pinch"></div>` : key('Q');
    else if (k === 'still') html = `<div class="g-breath"></div>`;
    else if (k === 'swell') html = touch ? `<div class="g-two"><div class="g-finger hold"></div><div class="g-finger hold"></div></div>` : key('F');
    if (e._html !== html) { e.innerHTML = html; e._html = html; }
    const [sx, sy] = this.G.worldToScreen(h.d.hx ?? h.x, h.d.hy ?? h.y);
    e.style.transform = `translate(${sx}px, ${sy}px)`;
    e.style.opacity = alpha.toFixed(3);
    e._seen = this.G.t;
  }
  sweepHints() { for (const [h, e] of this.hintEls) if (e._seen !== this.G.t) { e.style.opacity = 0; if (h.dead) { e.remove(); this.hintEls.delete(h); } } }
  clearHints() { this.hints.innerHTML = ''; this.hintEls.clear(); }

  // ── trick toasts ─────────────────────────────────────────────────────
  toast(name, glyph = '✦', cls = '') {
    const t = el('div', `h-toast ${cls}`, `<span class="g">${glyph}</span><span class="n">${name}</span>`);
    this.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1700);
    setTimeout(() => t.remove(), 2600);
  }

  // ── corner affordance (pause) ────────────────────────────────────────
  setCorner(on, onClick) {
    this.corner.innerHTML = on ? '<button class="pz" aria-label="pause"><span></span><span></span></button>' : '';
    if (on) this.corner.querySelector('button').onclick = (e) => { e.stopPropagation(); onClick(); };
  }

  // ── menus & cards ────────────────────────────────────────────────────
  openMenu(title, items, sub = '') {
    this.menu.innerHTML = `<div class="panel"><div class="m-title">${title}</div>${sub ? `<div class="m-sub">${sub}</div>` : ''}<div class="m-items"></div></div>`;
    const box = this.menu.querySelector('.m-items');
    items.forEach(it => {
      const b = el('button', 'm-item' + (it.cls ? ' ' + it.cls : ''), it.label);
      b.onclick = (e) => { e.stopPropagation(); it.fn(); };
      box.appendChild(b);
    });
    this.menu.classList.remove('hidden');
    this.menuOpen = true;
  }
  closeMenu() { this.menu.classList.add('hidden'); this.menuOpen = false; }

  showCard(html, buttons = []) {
    this.card.innerHTML = `<div class="panel">${html}<div class="c-btns"></div></div>`;
    const box = this.card.querySelector('.c-btns');
    buttons.forEach(it => { const b = el('button', 'm-item' + (it.cls ? ' ' + it.cls : ''), it.label); b.onclick = (e) => { e.stopPropagation(); it.fn(); }; box.appendChild(b); });
    this.card.classList.remove('hidden');
    requestAnimationFrame(() => this.card.classList.add('in'));
    this.cardOpen = true;
  }
  hideCard() { this.card.classList.remove('in'); this.card.classList.add('hidden'); this.cardOpen = false; }
}
