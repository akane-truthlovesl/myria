// node tools/crop.mjs <in.png> <out.png> x y w h [scale] — crop/zoom a PNG written by writePNG (8-bit RGB, filter 0)
import fs from 'node:fs'; import zlib from 'node:zlib';
import { writePNG } from './node-env.mjs';
const [inp, out, x, y, w, h, s = '1'] = process.argv.slice(2);
const buf = fs.readFileSync(inp); let p = 8, W = 0, H = 0, ct = 2; const idat = [];
while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8); if (type === 'IHDR') { W = buf.readUInt32BE(p + 8); H = buf.readUInt32BE(p + 12); ct = buf[p + 17]; } if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len)); p += 12 + len; }
const bpp = ct === 6 ? 4 : 3; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = W * bpp + 1;
const px = new Uint32Array(W * H); const prev = new Uint8Array(W * bpp), cur = new Uint8Array(W * bpp);
for (let yy = 0; yy < H; yy++) {
  const f = raw[yy * stride];
  for (let i = 0; i < W * bpp; i++) { const v = raw[yy * stride + 1 + i]; const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let r;
    if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1); else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
    cur[i] = r & 255; }
  for (let xx = 0; xx < W; xx++) px[yy * W + xx] = 0xff000000 | (cur[xx * bpp + 2] << 16) | (cur[xx * bpp + 1] << 8) | cur[xx * bpp];
  prev.set(cur);
}
const S = +s, cw = +w, ch = +h, x0 = +x, y0 = +y; const o = new Uint32Array(cw * S * ch * S);
for (let yy = 0; yy < ch * S; yy++) for (let xx = 0; xx < cw * S; xx++) { const sx = Math.min(W - 1, Math.max(0, x0 + ((xx / S) | 0))), sy = Math.min(H - 1, Math.max(0, y0 + ((yy / S) | 0))); o[yy * cw * S + xx] = px[sy * W + sx]; }
writePNG(out, cw * S, ch * S, o);
console.log(`${W}x${H} → ${cw * S}x${ch * S}`);
