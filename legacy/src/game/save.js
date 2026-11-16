// Persistent progress (localStorage, defensive — works in private windows too)
const KEY = 'myria.save.v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } }
function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { /* ignore */ } }

export const save = {
  data: load(),
  get(k, def) { return this.data[k] ?? def; },
  set(k, v) { this.data[k] = v; store(this.data); },
  chamber(id) { return (this.data.chambers || {})[id] || null; },
  recordChamber(id, r) {
    const all = this.data.chambers || (this.data.chambers = {});
    const prev = all[id];
    const stars = prev ? prev.stars.map((s, i) => s || r.stars[i]) : r.stars;
    const best = prev ? Math.min(prev.best, r.time) : r.time;
    all[id] = { stars, best, done: true, prisms: Math.max(prev?.prisms || 0, r.prisms) };
    store(this.data);
    return { newBest: !prev || r.time < prev.best - 0.01 };
  },
  starsTotal() { let n = 0; for (const c of Object.values(this.data.chambers || {})) n += c.stars.filter(Boolean).length; return n; },
};
