// ─────────────────────────────────────────────────────────────────────────────
//  The album — small pictures of the moments that mattered (a trick found for
//  the first time, a warden passed, a new size, the last room), each with a
//  line under it, kept on this device. The Atrium shows them, newest first.
//
//  Kept apart from the save (its own key): a few dozen thumbnails are a few
//  hundred kilobytes, and the save is rewritten on every little event.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'myria.album.v1', MAX = 40;

function read() { try { const L = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(L) ? L : []; } catch (_) { return []; } }

export const album = {
  list() { return typeof localStorage === 'undefined' ? [] : read(); },
  count() { return this.list().length; },
  // entry: { src: data URL, caption, sub, t }. When the device is full, the oldest half makes room (a scrapbook, not an archive)
  add(entry) {
    if (typeof localStorage === 'undefined') return false;
    const L = read(); L.push(entry); while (L.length > MAX) L.shift();
    for (let k = 0; k < 3; k++) { try { localStorage.setItem(KEY, JSON.stringify(L)); return true; } catch (_) { if (L.length <= 1) return false; L.splice(0, Math.ceil(L.length / 2)); } }
    return false;
  },
  clear() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } },
};
