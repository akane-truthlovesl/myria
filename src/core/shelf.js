// ─────────────────────────────────────────────────────────────────────────────
//  The Workshop's shelf, kept on this device apart from the save (its own key —
//  runs are a few kilobytes each, and the save is rewritten on every event):
//    · the bench: the chamber you are making, and the run that sealed it
//    · runs: your best way through every made chamber you have played (yours
//      or a stranger's) — the pale bead you race the next time
//    · gifts: the last few chambers handed to you, to play again
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'myria.shelf.v1', RUNS = 16, GIFTS = 8;
const ok = () => typeof localStorage !== 'undefined';
function read() { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === 'object' ? d : {}; } catch (_) { return {}; } }
function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (_) { return false; } }

export const shelf = {
  bench() { return ok() ? read().bench || null : null; },
  setBench(b) { if (!ok()) return; const d = read(); d.bench = b; write(d); },
  run(h) { return ok() ? (read().runs || {})[h] || null : null; },
  setRun(h, r) {
    if (!ok()) return; const d = read(), runs = d.runs || (d.runs = {}); runs[h] = { t: r.t, p: r.p, at: Date.now() };
    const keys = Object.keys(runs); if (keys.length > RUNS) { keys.sort((a, b) => runs[a].at - runs[b].at); for (const k of keys.slice(0, keys.length - RUNS)) delete runs[k]; }
    if (!write(d)) { d.runs = { [h]: runs[h] }; write(d); }
  },
  gifts() { return ok() ? read().gifts || [] : []; },
  addGift(g) { if (!ok()) return; const d = read(); const L = (d.gifts || []).filter(q => q.h !== g.h); L.push({ ...g, at: Date.now() }); while (L.length > GIFTS) L.shift(); d.gifts = L; write(d); },
  clear() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } },
};
