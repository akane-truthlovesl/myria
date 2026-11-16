// Render a chamber's SDF + entities to a PNG for quick layout review: node tools/levelmap.mjs <index> <out.png>
import { buildSDF } from '../src/engine/sdf.js';
import zlib from 'zlib';
import fs from 'fs';
globalThis.document = undefined;
const { CHAMBERS } = await import('../src/levels/odyssey.js');
const idx = +process.argv[2]; const out = process.argv[3] || `/tmp/level${idx}.png`;
const L = CHAMBERS[idx];
const [x0, y0, x1, y1] = L.bounds;
const g = buildSDF({ x0: x0 - 40, y0: y0 - 40, x1: x1 + 40, y1: y1 + 40, res: 4, base: L.base || 'solid', ops: L.geo });
const S = 3; // world units per pixel
const W = Math.ceil((x1 - x0) / S), Hh = Math.ceil((y1 - y0) / S);
const px = Buffer.alloc(W * Hh * 3);
const matCol = [[70, 80, 90], [90, 150, 190], [190, 120, 40], [120, 90, 80], [40, 200, 220], [80, 220, 140], [110, 115, 125], [255, 60, 60], [170, 210, 240], [220, 90, 40]];
for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
  const wx = x0 + i * S, wy = y0 + j * S;
  const gi = Math.min(g.w - 1, Math.max(0, Math.round((wx - g.x0) / g.res))), gj = Math.min(g.h - 1, Math.max(0, Math.round((wy - g.y0) / g.res)));
  const d = g.data[gj * g.w + gi]; const m = g.mat[gj * g.w + gi];
  const o = (j * W + i) * 3;
  let c = d < 0 ? matCol[m] || [70, 80, 90] : [8, 16, 26];
  if (d >= 0 && (Math.round(wx) % 100 < S || Math.round(wy) % 100 < S)) c = [20, 32, 44];
  if (Math.abs(d) < 2) c = [200, 220, 235];
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}
const dot = (x, y, r, c) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (i * i + j * j > r * r) continue; const X = Math.round((x - x0) / S) + i, Y = Math.round((y - y0) / S) + j; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const o = (Y * W + X) * 3; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; } };
const colOf = { mote: [255, 210, 120], prism: [200, 160, 255], lantern: [255, 160, 80], exit: [80, 230, 255], plate: [80, 255, 180], gate: [180, 180, 200], blade: [255, 50, 50], grinder: [255, 120, 40], hint: [255, 255, 255], pool: [255, 120, 200], bumper: [60, 240, 255], singularity: [255, 255, 0], geyser: [120, 255, 255], current: [100, 160, 255], zone: [150, 120, 255], magnet: [120, 140, 255], membrane: [120, 255, 160], crusher: [200, 200, 200], oil: [255, 200, 40] };
for (const e of L.entities) {
  const c = colOf[e.type] || [255, 0, 255];
  const r = e.type === 'mote' ? 2 : e.type === 'exit' ? 9 : 5;
  if (e.type === 'gate') { for (let k = -e.h / 2; k <= e.h / 2; k += 3) dot(e.x, e.y + k, Math.max(2, (e.w || 30) / 6), c); continue; }
  if (e.type === 'plate') { for (let k = -e.w / 2; k <= e.w / 2; k += 3) dot(e.x + k, e.y, 2, c); continue; }
  if (e.type === 'blade' || e.type === 'membrane' || e.type === 'bumper') { const len = e.len || 120, a = e.angle || 0; for (let k = -len / 2; k <= len / 2; k += 3) dot(e.x + Math.cos(a) * k, e.y + Math.sin(a) * k, 2, c); continue; }
  if (e.type === 'pool' || e.type === 'zone' || e.type === 'current') { const w = e.w, h = e.h; for (let k = -w / 2; k <= w / 2; k += 3) { dot(e.x + k, e.y - h / 2, 1, c); dot(e.x + k, e.y + h / 2, 1, c); } for (let k = -h / 2; k <= h / 2; k += 3) { dot(e.x - w / 2, e.y + k, 1, c); dot(e.x + w / 2, e.y + k, 1, c); } continue; }
  dot(e.x, e.y, r, c);
}
dot(L.spawn[0], L.spawn[1], 6, [255, 120, 100]);
// PNG encode
const raw = Buffer.alloc((W * 3 + 1) * Hh);
for (let j = 0; j < Hh; j++) { raw[j * (W * 3 + 1)] = 0; px.copy(raw, j * (W * 3 + 1) + 1, j * W * 3, (j + 1) * W * 3); }
const chunk = (t, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); const crc = zlib.crc32 ? zlib.crc32(Buffer.concat([Buffer.from(t), d])) : 0; b.writeUInt32BE(crc >>> 0, 8 + d.length); return b; };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(Hh, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, W, Hh, 'motes', L.entities.filter(e => e.type === 'mote').length);
