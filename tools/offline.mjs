// node tools/offline.mjs <out.png> [w] [h] [frames] [zoom:x,y,w,h,s]  — render the prototype scene without a browser
import { fakeCanvas, writePNG, writeZoom, cpuMs } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { makeScene } from './proto_scene.mjs';
const [out, w = '1280', h = '720', frames = '30', zoom = '', cell = '0'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(+w, +h)); R.fluid.cellOverride = +cell; R.resize(true);
const S = makeScene(R, {});
const tb = cpuMs(() => R.setRoom(S.room, true));
let phys = 0, fluid = 0, n = 0; const st = { tSplat: 0, tDome: 0, tShade: 0 };
for (let f = 0; f < +frames; f++) {
  if (f === 5) S.target = [S.W * 0.62, S.H * 0.38];
  const p = cpuMs(() => S.step());
  S.build();
  const fl = cpuMs(() => R.frame({ phys: S.P }, f / 60));
  if (f >= +frames - 60) { phys += p; fluid += fl; n++; const fs = R.fluid.stats; st.tSplat += fs.tSplat; st.tDome += fs.tDome; st.tShade += fs.tShade; }
}
const fs = R.fluid.stats;
console.log(JSON.stringify({ fb: [R.fb.w, R.fb.h], z: +R.view.z.toFixed(3), backdropCpuMs: Math.round(tb), physCpu: +(phys / n).toFixed(2), frameCpu: +(fluid / n).toFixed(2), splat: +(st.tSplat / n).toFixed(2), dome: +(st.tDome / n).toFixed(2), shade: +(st.tShade / n).toFixed(2), cell: R.fluid.cell, fluidPx: fs.px, platePx: fs.plate, nodes: fs.nodes, dirty: R.stats.dirty }));
writePNG(out, R.fb.w, R.fb.h, R.fb.px);
if (zoom) { const [x, y, cw, ch, s] = zoom.split(',').map(Number); writeZoom(out.replace('.png', '_z.png'), R.fb.w, R.fb.h, R.fb.px, x, y, cw, ch, s); }
