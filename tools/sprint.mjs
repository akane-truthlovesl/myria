// Which (chamber, mutation) pairs can the Daily Sprint be drawn from?  Every pair the bot finishes in BOTH orientations.
//   node tools/sprint.mjs            → prints the list to paste into SPRINT_OK (src/modes/odyssey.js); takes the better part of an hour on a slow machine
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { ROOMS } = await import('../src/world/odyssey.js'); const { SPRINTS } = await import('../src/modes/odyssey.js');
const ok = [], bad = [];
for (const m of SPRINTS) {
  const done = {}; for (const [w, h] of [[1280, 720], [900, 1060]]) {
    const r = spawnSync('node', ['tools/solve.mjs', '1', String(ROOMS.length - 2), String(w), String(h), '1'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SPRINT: m.id }, maxBuffer: 64 << 20 });
    for (const line of (r.stdout || '').split('\n')) { const q = /^\s*(\d+) .* (DONE|FAIL) t=\s*([\d.]+)/.exec(line); if (q) (done[q[1]] = done[q[1]] || []).push(q[2] === 'DONE' ? +q[3] : -1); }
  }
  for (const [i, v] of Object.entries(done)) { const id = ROOMS[+i].id; if (v.length === 2 && v.every(t => t > 0)) ok.push([id, m.id]); else bad.push(`${id}/${m.id}`); }
  console.error(`${m.id}: ${ok.filter(p => p[1] === m.id).length} chambers finished both ways`);
}
console.log('export const SPRINT_OK = ' + JSON.stringify(ok) + ';'); console.error('not finished both ways: ' + (bad.join(' ') || 'none'));
