// Persistent progress (localStorage, defensive — works in private windows and from file://)
const KEY = 'myria.save.v2';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } }
function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { /* ignore */ } }
export const save = {
  data: typeof localStorage !== 'undefined' ? load() : {},
  get(k, def) { return this.data[k] ?? def; },
  set(k, v) { this.data[k] = v; store(this.data); },
  room(id) { return (this.data.rooms || {})[id] || null; },
  recordRoom(id, r) {            // r = { stars:[bool,bool,bool], time, light }
    const all = this.data.rooms || (this.data.rooms = {}); const prev = all[id];
    const stars = prev ? prev.stars.map((s, i) => s || r.stars[i]) : r.stars.slice();
    all[id] = { stars, best: prev ? Math.min(prev.best, r.time) : r.time, light: Math.max(prev ? prev.light : 0, r.light) };
    store(this.data);
    return { newBest: !prev || r.time < prev.best - 0.01, firstClear: !prev };
  },
  // echo: the path of your best run through a chamber, as a ghost to race ({ t: seconds, p: packed path })
  echo(id) { return (this.data.echo || {})[id] || null; },
  setEcho(id, e) { (this.data.echo || (this.data.echo = {}))[id] = e; store(this.data); },
  stars() { let n = 0; for (const c of Object.values(this.data.rooms || {})) n += c.stars.filter(Boolean).length; return n; },
  trick(name) { const t = this.data.tricks || (this.data.tricks = {}); const first = !t[name]; t[name] = (t[name] || 0) + 1; store(this.data); return first; },
  reset() { this.data = {}; store(this.data); },
};
