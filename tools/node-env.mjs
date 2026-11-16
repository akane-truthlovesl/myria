// Minimal DOM stand-ins so the CPU renderer can run under Node (offline frames, CPU-time profiling).
import zlib from 'node:zlib';
import fs from 'node:fs';
export function fakeCanvas(w, h) {
  const ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, drawImage() {}, save() {}, restore() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    set globalCompositeOperation(v) {}, set fillStyle(v) {}, set globalAlpha(v) {},
  };
  return { width: w, height: h, clientWidth: w, clientHeight: h, getContext: () => ctx, style: {} };
}
globalThis.window = globalThis.window || { devicePixelRatio: 1 };
export function writePNG(path, w, h, px32, crop) {
  let [x0, y0, cw, ch] = crop || [0, 0, w, h];
  x0 = Math.max(0, Math.min(w - 1, x0 | 0)); y0 = Math.max(0, Math.min(h - 1, y0 | 0)); cw = Math.min(cw | 0, w - x0); ch = Math.min(ch | 0, h - y0);
  const raw = Buffer.alloc((cw * 3 + 1) * ch);
  for (let y = 0; y < ch; y++) { const o = y * (cw * 3 + 1); raw[o] = 0; for (let x = 0; x < cw; x++) { const p = px32[(y + y0) * w + x + x0]; raw[o + 1 + x * 3] = p & 255; raw[o + 2 + x * 3] = (p >> 8) & 255; raw[o + 3 + x * 3] = (p >> 16) & 255; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]));
}
// nearest-neighbour magnified crop (for pixel-peeping)
export function writeZoom(path, w, h, px32, x0, y0, cw, ch, s) {
  const out = new Uint32Array(cw * s * ch * s);
  for (let y = 0; y < ch * s; y++) for (let x = 0; x < cw * s; x++) { const sx = Math.min(w - 1, Math.max(0, x0 + ((x / s) | 0))), sy = Math.min(h - 1, Math.max(0, y0 + ((y / s) | 0))); out[y * cw * s + x] = px32[sy * w + sx]; }
  writePNG(path, cw * s, ch * s, out);
}
export function cpuMs(fn) { const a = process.cpuUsage(); fn(); const b = process.cpuUsage(a); return (b.user + b.system) / 1000; }

globalThis.__cpuNow = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
