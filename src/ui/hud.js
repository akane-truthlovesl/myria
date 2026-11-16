// ─────────────────────────────────────────────────────────────────────────────
//  HUD — almost nothing on screen. A pill with the room's light and its three
//  living stars, a title that etches itself and fades, toasts for named tricks,
//  and a result card that lives in the dark between chambers.
// ─────────────────────────────────────────────────────────────────────────────
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class HUD {
  constructor(root) {
    this.root = root; root.innerHTML = '';
    this.iris = el('div'); this.iris.id = 'iris'; document.body.insertBefore(this.iris, root);
    this.labels = el('div', 'h-labels'); root.appendChild(this.labels);
    this.title = el('div', 'h-title'); root.appendChild(this.title);
    this.top = el('div', 'h-top'); root.appendChild(this.top);
    this.hintEl = el('div', 'h-hint'); root.appendChild(this.hintEl);
    this.toasts = el('div', 'h-toasts'); root.appendChild(this.toasts);
    this.result = el('div', 'h-result'); root.appendChild(this.result);
    this.corner = el('div', 'h-corner'); root.appendChild(this.corner);
    this.veil = el('div', 'h-veil'); root.appendChild(this.veil);
    this.loader = el('div', 'h-loader', '<i></i>'); root.appendChild(this.loader);
    this.flash = el('div', 'h-flash'); root.appendChild(this.flash); this._fl = 0;
    this._top = ''; this.labelEls = [];
  }
  // ── iris wipe: a hole of light centred on (x,y) css px, radius r css px (r<0 → fully dark) ──
  setIris(x, y, r, a = 1) {
    const s = this.iris.style;
    if (r === null) { s.opacity = 0; return; }
    s.opacity = a;
    s.background = r <= 0 ? '#010407' : `radial-gradient(circle at ${x.toFixed(0)}px ${y.toFixed(0)}px, rgba(1,4,7,0) ${Math.max(0, r - 26).toFixed(0)}px, rgba(1,4,7,1) ${r.toFixed(0)}px)`;
  }
  showTitle(no, name, sub = '', dur = 3.0) {
    this.title.innerHTML = `${no ? `<div class="t-no">${no}</div>` : ''}<div class="t-name">${name}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}`;
    this.title.classList.add('in'); clearTimeout(this._tt);
    if (dur > 0) this._tt = setTimeout(() => this.title.classList.remove('in'), dur * 1000);
  }
  // a breath of light over everything (the compositor does it: no pixel of the game is redrawn)
  setFlash(v) { const q = v > 0.02 ? Math.round(v * 20) / 20 : 0; if (q !== this._fl) { this._fl = q; this.flash.style.opacity = (q * 0.34).toFixed(3); } }
  hideTitle() { this.title.classList.remove('in'); }
  setLoader(on) { if (on !== this._ld) { this._ld = on; this.loader.classList.toggle('on', !!on); } }
  // ── top pill ──
  setTop(o) {
    if (!o) { this.top.classList.remove('on'); this._top = ''; return; }
    const key = `${o.light}|${o.total}|${o.quota}|${o.stars ? o.stars.join('') : ''}|${o.extra || ''}`;
    if (key === this._top) return; this._top = key;
    const st = o.stars ? `<span class="st">${o.stars.map(s => `<s class="${s === 1 ? 'on' : s === -1 ? 'lost' : ''}"></s>`).join('')}</span>` : '';
    const bar = o.total ? `<span class="bar"><b style="width:${Math.min(100, o.light / o.total * 100).toFixed(1)}%"></b>${o.quota ? `<u style="left:${(o.quota / o.total * 100).toFixed(1)}%"></u>` : ''}</span>` : '';
    this.top.innerHTML = `<span class="mt"><i></i>${o.light}${o.total ? `<small>/ ${o.total}</small>` : ''}</span>${bar}${st}${o.extra ? `<span class="ex">${o.extra}</span>` : ''}`;
    this.top.classList.add('on');
  }
  toast(name, glyph = '✦', cls = '') {
    const t = el('div', `h-toast ${cls}`, `<span class="g">${glyph}</span>${name}`);
    this.toasts.appendChild(t); while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 1900); setTimeout(() => t.remove(), 2800);
  }
  hint(html) { if (html === this._hint) return; this._hint = html; if (html) { this.hintEl.innerHTML = html; this.hintEl.classList.add('on'); } else this.hintEl.classList.remove('on'); }
  setCorner(on, fn) { this.corner.innerHTML = on ? '<button aria-label="pause"><span></span><span></span></button>' : ''; if (on) this.corner.querySelector('button').onclick = (e) => { e.stopPropagation(); fn(); }; }
  // ── result card (between chambers) ──
  showResult(r) {
    const names = ['Radiance', 'Grace', 'Swift'];
    this.result.innerHTML = `<div class="r-name">${r.name}</div><div class="r-stars">${names.map((n, i) => `<div class="r-star" data-i="${i}"><i></i>${n}</div>`).join('')}</div>
      <div class="r-stats">light <b>${r.light}</b> / ${r.total} &nbsp;·&nbsp; time <b>${r.time.toFixed(1)}s</b>${r.par ? ` <span>/ ${r.par}s</span>` : ''} &nbsp;·&nbsp; mass <b>${r.mass}</b>${r.chain >= 8 ? ` &nbsp;·&nbsp; chain <b>♪ ${r.chain}</b>` : ''}</div>
      <div class="r-tricks">${(r.tricks || []).join(' &nbsp;·&nbsp; ')}</div><div class="r-next">${r.next || ''}</div>`;
    this.result.classList.add('on');
    r.stars.forEach((s, i) => { if (s) setTimeout(() => { const e = this.result.querySelector(`.r-star[data-i="${i}"]`); if (e) e.classList.add('on'); r.onStar && r.onStar(i); }, 260 + i * 240); });
    setTimeout(() => { const e = this.result.querySelector('.r-next'); if (e) e.classList.add('on'); }, 1100);
  }
  hideResult() { this.result.classList.remove('on'); }
  // ── modal panel ──
  panel(title, sub, items, extraHtml = '') {
    this.veil.innerHTML = `<div class="panel"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}${extraHtml}<div class="m-items"></div></div>`;
    const box = this.veil.querySelector('.m-items');
    for (const it of items) {
      if (Array.isArray(it)) { const row = el('div', 'm-row'); for (const j of it) { const b = el('button', 'm-item' + (j.cls ? ' ' + j.cls : ''), j.label); b.onclick = (e) => { e.stopPropagation(); j.fn(b); }; row.appendChild(b); } box.appendChild(row); }
      else { const b = el('button', 'm-item' + (it.cls ? ' ' + it.cls : ''), it.label); b.onclick = (e) => { e.stopPropagation(); it.fn(b); }; box.appendChild(b); }
    }
    this.veil.classList.add('on'); this.panelOpen = true;
  }
  closePanel() { this.veil.classList.remove('on'); this.panelOpen = false; }
  // ── labels pinned to world points ──
  setLabels(list) {       // [{x,y (css px), html, cls}]
    while (this.labelEls.length < list.length) { const e = el('div', 'h-label'); this.labels.appendChild(e); this.labelEls.push(e); }
    this.labelEls.forEach((e, i) => { const l = list[i]; if (!l) { e.style.display = 'none'; return; } e.style.display = ''; if (e._h !== l.html) { e.innerHTML = l.html; e._h = l.html; } e.className = 'h-label ' + (l.cls || ''); e.style.left = l.x + 'px'; e.style.top = l.y + 'px'; });
  }
}
