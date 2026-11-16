// How many lights does the Abyss generator put inside (or flush against) something solid?  node tools/embedded.mjs [seeds] [depths]
import { World } from '../src/world/world.js';
import { abyssRoom, AXIOMS } from '../src/world/abyss.js';
const [seeds = '60', depths = '9'] = process.argv.slice(2);
let rooms = 0, bad = 0, motes = 0, inside = 0, flush = 0; const worst = [];
for (let s = 1; s <= +seeds; s++) for (let d = 1; d <= +depths; d++) {
  if (d % 5 === 0) continue; const W = new World({}); const spec = abyssRoom(16 / 9, d, s * 7717, null, 60); W.load(spec, {}); for (let k = 0; k < 4; k++) W.step(1 / 60, { intent: null });
  let n = 0; for (const m of W.pickups) { if (!m.isMote || m.dead) continue; motes++; const sd = W.phys.sampleSDF(m.x, m.y); if (sd < 0) { inside++; n++; } else if (sd < 9) { flush++; n++; } }
  rooms++; if (n) { bad++; if (worst.length < 6) worst.push(`seed ${s * 7717} depth ${d}: ${n}`); }
}
console.log(`${rooms} rooms, ${motes} lights: ${inside} inside a wall, ${flush} flush against one (<9) — ${bad} rooms affected (${(100 * bad / rooms).toFixed(0)}%)`); console.log(worst.join(' · '));
