import { createGL, Program, texture, fbo, bind, fullscreen, instanced } from './gl.js';
import * as S from './shaders.js';
import { MATS } from '../engine/materials.js';

export const KERNEL_R = 13.5;   // splat radius in world units
export const ISO_T = 0.62;      // isosurface threshold

// float32 → float16 bits
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v) {
  f32[0] = v; const x = u32[0];
  const sign = (x >> 16) & 0x8000; let e = ((x >> 23) & 0xff) - 127 + 15; let m = x & 0x7fffff;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7c00;
  return sign | (e << 10) | (m >> 13);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = createGL(canvas);
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.fs = fullscreen(gl);
    this.p = {
      splat: new Program(gl, S.SPLAT_VS, S.SPLAT_FS, 'splat'),
      height: new Program(gl, S.FULL_VS, S.HEIGHT_FS, 'height'),
      scene: new Program(gl, S.FULL_VS, S.SCENE_FS, 'scene'),
      ent: new Program(gl, S.ENT_VS, S.ENT_FS, 'ent'),
      comp: new Program(gl, S.FULL_VS, S.COMP_FS, 'comp'),
      fx: new Program(gl, S.FX_VS, S.FX_FS, 'fx'),
      bright: new Program(gl, S.FULL_VS, S.BRIGHT_FS, 'bright'),
      down: new Program(gl, S.FULL_VS, S.DOWN_FS, 'down'),
      up: new Program(gl, S.FULL_VS, S.UP_FS, 'up'),
      final: new Program(gl, S.FULL_VS, S.FINAL_FS, 'final'),
    };
    this.splats = instanced(gl, 12, [4, 4, 4], 8192);
    this.ents = instanced(gl, 12, [4, 4, 4], 2048);
    this.fx = instanced(gl, 12, [4, 4, 4], 6144);
    this.fxTop = instanced(gl, 12, [4, 4, 4], 1024);
    this.lights = new Float32Array(16 * 4); this.lightC = new Float32Array(16 * 4); this.nl = 0;
    this.shA = new Float32Array(24 * 4); this.shB = new Float32Array(24 * 4); this.shC = new Float32Array(24 * 4); this.ns = 0;
    this.scale = 1; this.maxDpr = 1.5;
    this.quality = 1;
    this.pal = {
      p0: [0.004, 0.010, 0.018], p1: [0.012, 0.035, 0.052], p2: [0.055, 0.085, 0.10], p3: [0.55, 0.85, 0.95], p4: [1.0, 0.6, 0.35],
      sky: [0.55, 0.75, 0.9], grid: 1, bright: 1,
    };
    this.post = { bloom: 0.42, expo: 1.0, vig: 0.55, flash: [0, 0, 0, 0], fade: 1, sat: 1.08, caust: 1, thresh: 0.8 };
    this.danger = [1, 0.25, 0.15, 0];
    this.sdfTex = null;
    this.time = 0;
    this.resize();
  }

  setQuality(q) { this.quality = q; this.maxDpr = q >= 2 ? 2 : q >= 1 ? 1.5 : 1; this.resize(true); }

  resize(force) {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const cw = Math.max(2, Math.floor(this.canvas.clientWidth * dpr * this.scale));
    const ch = Math.max(2, Math.floor(this.canvas.clientHeight * dpr * this.scale));
    if (!force && cw === this.W && ch === this.H) return;
    this.W = cw; this.H = ch;
    this.canvas.width = cw; this.canvas.height = ch;
    this.cssScale = dpr * this.scale;
    const free = (o) => { if (!o) return; if (o.tex) o.tex.forEach(t => gl.deleteTexture(t)); gl.deleteFramebuffer(o); };
    [this.sceneF, this.fieldF, this.heightF, this.hdrF, ...(this.bloomF || [])].forEach(free);
    const hw = Math.max(2, Math.floor(cw / 2)), hh = Math.max(2, Math.floor(ch / 2));
    this.sceneF = fbo(gl, [texture(gl, cw, ch)]);
    this.fieldF = fbo(gl, [texture(gl, hw, hh, { mips: true }), texture(gl, hw, hh, { mips: true }), texture(gl, hw, hh), texture(gl, hw, hh)]);
    this.heightF = fbo(gl, [texture(gl, hw, hh)]);
    this.hdrF = fbo(gl, [texture(gl, cw, ch)]);
    this.bloomF = [];
    let bw = hw, bh = hh;
    for (let k = 0; k < 5; k++) { this.bloomF.push(fbo(gl, [texture(gl, Math.max(2, bw), Math.max(2, bh))])); bw >>= 1; bh >>= 1; }
    this.hw = hw; this.hh = hh;
  }

  setLevel(grid) {
    const gl = this.gl;
    if (this.sdfTex) { gl.deleteTexture(this.sdfTex); gl.deleteTexture(this.matTex); gl.deleteTexture(this.matWTex); }
    const n = grid.w * grid.h;
    const half = new Uint16Array(n);
    for (let i = 0; i < n; i++) half[i] = toHalf(grid.data[i]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.sdfTex = texture(gl, grid.w, grid.h, { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, data: half });
    this.matTex = texture(gl, grid.w, grid.h, { internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE, data: grid.mat, filter: gl.NEAREST });
    // smooth material weights (linear-filtered): R glass/ice · G resin · B metal · A grit/bounce/warm/membrane
    const mw = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const m = grid.mat[i];
      if (m === 1 || m === 8) mw[i * 4] = 255;
      else if (m === 2) mw[i * 4 + 1] = 255;
      else if (m === 6) mw[i * 4 + 2] = 255;
      else if (m === 3 || m === 4 || m === 5 || m === 9) mw[i * 4 + 3] = 255;
    }
    // soften seams: separable box blur (3 passes ≈ gaussian, ~10 world units) so material borders melt
    const W = grid.w, Hh = grid.h, tmp = new Float32Array(n * 4), acc = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) acc[i] = mw[i];
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
        let sum = 0, cnt = 0; for (let k = -1; k <= 1; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; sum += acc[(y * W + xx) * 4 + c]; cnt++; }
        tmp[(y * W + x) * 4 + c] = sum / cnt;
      }
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
        let sum = 0, cnt = 0; for (let k = -1; k <= 1; k++) { const yy = y + k; if (yy < 0 || yy >= Hh) continue; sum += tmp[(yy * W + x) * 4 + c]; cnt++; }
        acc[(y * W + x) * 4 + c] = sum / cnt;
      }
    }
    for (let i = 0; i < n * 4; i++) mw[i] = acc[i];
    this.matWTex = texture(gl, grid.w, grid.h, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, data: mw, filter: gl.LINEAR });
    this.grid = grid;
    this.sdfRect = [grid.x0, grid.y0, 1 / (grid.w * grid.res), 1 / (grid.h * grid.res)];
    // texel centres: data[i] lives at x0 + i*res → uv = (i+0.5)/w → shift origin by half a texel
    this.sdfRect[0] -= grid.res * 0.5; this.sdfRect[1] -= grid.res * 0.5;
  }

  clearLights() { this.nl = 0; }
  light(x, y, z, radius, r, g, b, intensity) {
    if (this.nl >= 16) return;
    const k = this.nl * 4;
    this.lights[k] = x; this.lights[k + 1] = y; this.lights[k + 2] = z; this.lights[k + 3] = radius;
    this.lightC[k] = r; this.lightC[k + 1] = g; this.lightC[k + 2] = b; this.lightC[k + 3] = intensity;
    this.nl++;
  }
  setShapes(shapes) {
    this.ns = 0;
    for (const s of shapes) {
      if (this.ns >= 24) break;
      if (s.hidden || s.active === false) continue;
      const k = this.ns * 4;
      const vt = s.vis ?? s.type;
      this.shA[k] = vt; this.shA[k + 1] = s.x; this.shA[k + 2] = s.y; this.shA[k + 3] = s.angle;
      if (s.type === 0) { this.shB[k] = s.r; this.shB[k + 1] = 0; this.shB[k + 2] = 0; this.shB[k + 3] = 0; }
      else if (s.type === 1) { this.shB[k] = s.r; this.shB[k + 1] = s.hl; this.shB[k + 2] = 0; this.shB[k + 3] = 0; }
      else if (s.type === 2) { this.shB[k] = s.r; this.shB[k + 1] = s.hw; this.shB[k + 2] = s.hh; this.shB[k + 3] = 0; }
      else if (s.type === 3) { this.shB[k] = s.r; this.shB[k + 1] = s.R; this.shB[k + 2] = 0; this.shB[k + 3] = s.gap || 0; }
      if (vt === 4) { this.shB[k] = 0; this.shB[k + 1] = s.r; this.shB[k + 2] = s.teeth || 10; this.shB[k + 3] = s.toothH || 8; }
      this.shC[k] = s.surf; this.shC[k + 1] = s.glow || 0; this.shC[k + 2] = 0; this.shC[k + 3] = 0;
      this.ns++;
    }
  }

  // pack particles into the splat batch
  packParticles(phys, layerOf, tintOf, time = 0) {
    const b = this.splats; b.reset();
    const { x, y, alive, hi, mat, body, rr, glow, bodies } = phys;
    const d = b.data; let n = 0;
    const cap = b.cap;
    for (let i = 0; i < hi && n < cap; i++) {
      if (!alive[i]) continue;
      const B = bodies[body[i]];
      const m = MATS[mat[i]];
      const tint = B.tint || (tintOf && tintOf(B));
      const ab = tint ? tint.absorb : m.absorb;
      const em = tint ? tint.emit : m.emit;
      // in-scatter from the heart: luminous core → translucent rim, with a heartbeat wave
      let core = 0.35;
      if (B.r > 1) {
        const dx = x[i] - B.cx, dy = y[i] - B.cy;
        const dd = Math.sqrt(dx * dx + dy * dy) / (B.r + 6);
        const beat = B.beat !== undefined ? B.beat : 0.5 + 0.5 * Math.sin(time * 2.2 - dd * 4.0);
        core = 0.08 + 1.15 * Math.exp(-dd * dd * 3.0) + 0.22 * beat * Math.exp(-dd * dd * 1.2);
      }
      const o = n * 12;
      const veil = B.veil || 0;
      d[o] = x[i]; d[o + 1] = y[i]; d[o + 2] = KERNEL_R * rr[i] * (1 - 0.18 * veil); d[o + 3] = layerOf ? layerOf(B) : 0;
      d[o + 4] = ab[0]; d[o + 5] = ab[1]; d[o + 6] = ab[2];
      d[o + 7] = (core * (B.glowMul || 1) * (1 + (B.energy || 0) * 0.35) + glow[i] * 0.9) * m.glowK * (1 - 0.88 * veil);
      d[o + 8] = em[0]; d[o + 9] = em[1]; d[o + 10] = em[2]; d[o + 11] = tint && tint.metal !== undefined ? tint.metal : m.metal;
      n++;
    }
    b.n = n;
  }

  frame(cam, time) {
    const gl = this.gl;
    this.time = time;
    const W = this.W, H = this.H;
    const zoom = cam.zoom * this.cssScale;            // device pixels per world unit
    const view = [W / zoom, H / zoom];
    const camC = [cam.x, cam.y];
    gl.disable(gl.DEPTH_TEST);
    // 1 ── scene (world)
    bind(gl, this.sceneF);
    const ps = this.p.scene.use();
    ps.f('uCam', ...camC).f('uView', ...view).f('uTime', time).f('uZoom', zoom);
    if (this.sdfTex) {
      ps.tex('uSDF', this.sdfTex).tex('uMatT', this.matTex).tex('uMatW', this.matWTex).f('uSDFRect', ...this.sdfRect);
    }
    const P = this.pal;
    ps.f('uPal0', ...P.p0).f('uPal1', ...P.p1).f('uPal2', ...P.p2).f('uPal3', ...P.p3).f('uPal4', ...P.p4);
    ps.f('uGridK', P.grid).f('uBright', P.bright);
    ps.v4('uLights', this.lights).v4('uLightC', this.lightC).i('uNL', this.nl);
    ps.v4('uShA', this.shA).v4('uShB', this.shB).v4('uShC', this.shC).i('uNS', this.ns);
    this.fs.draw();
    // entities into the scene (premultiplied-ish additive with alpha occlusion)
    if (this.ents.n) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const pe = this.p.ent.use();
      pe.f('uCam', ...camC).f('uView', ...view).f('uTime', time).f('uZoom', zoom);
      this.ents.draw();
      gl.disable(gl.BLEND);
    }
    // 2 ── splat fields
    bind(gl, this.fieldF);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const sp = this.p.splat.use();
    sp.f('uCam', ...camC).f('uView', ...view);
    this.splats.draw();
    gl.disable(gl.BLEND);
    // mips for the dome pyramid
    gl.bindTexture(gl.TEXTURE_2D, this.fieldF.tex[0]); gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldF.tex[1]); gl.generateMipmap(gl.TEXTURE_2D);
    // 3 ── heights
    bind(gl, this.heightF);
    const ph = this.p.height.use();
    // keep dome scale world-consistent across zoom: texel = 2/zoom world units
    const bias = -Math.log2(Math.max(0.25, Math.min(4, cam.zoom * this.cssScale)));
    ph.tex('uF0', this.fieldF.tex[0]).tex('uF1', this.fieldF.tex[1]).f('uT', ISO_T).f('uBias', bias + 0.0);
    this.fs.draw();
    // 4 ── composite
    bind(gl, this.hdrF);
    const pc = this.p.comp.use();
    pc.f('uCam', ...camC).f('uView', ...view).f('uTime', time).f('uZoom', zoom).f('uT', ISO_T);
    pc.tex('uScene', this.sceneF.tex[0]).tex('uF0', this.fieldF.tex[0]).tex('uF1', this.fieldF.tex[1])
      .tex('uE0', this.fieldF.tex[2]).tex('uE1', this.fieldF.tex[3]).tex('uH', this.heightF.tex[0]);
    pc.f('uHPx', 1 / this.hw, 1 / this.hh);
    pc.v4('uLights', this.lights).v4('uLightC', this.lightC).i('uNL', this.nl);
    pc.f('uSky', ...P.sky).f('uQual', this.quality).f('uDanger', ...this.danger).f('uCaust', this.post.caust);
    this.fs.draw();
    // 5 ── FX additive
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const pf = this.p.fx.use();
    pf.f('uCam', ...camC).f('uView', ...view).f('uTime', time).f('uZoom', zoom).f('uT', ISO_T).f('uScreen', W, H);
    pf.tex('uF0', this.fieldF.tex[0]).tex('uF1', this.fieldF.tex[1]);
    this.fx.draw();
    this.fxTop.draw();
    gl.disable(gl.BLEND);
    // 6 ── bloom
    const B0 = this.bloomF;
    bind(gl, B0[0]);
    this.p.bright.use().tex('uSrc', this.hdrF.tex[0]).f('uPx', 0.5 / W, 0.5 / H).f('uThresh', this.post.thresh);
    this.fs.draw();
    for (let k = 1; k < B0.length; k++) {
      bind(gl, B0[k]);
      this.p.down.use().tex('uSrc', B0[k - 1].tex[0]).f('uPx', 1 / B0[k - 1].w, 1 / B0[k - 1].h);
      this.fs.draw();
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let k = B0.length - 1; k > 0; k--) {
      bind(gl, B0[k - 1]);
      this.p.up.use().tex('uSrc', B0[k].tex[0]).f('uPx', 1 / B0[k].w, 1 / B0[k].h).f('uK', 0.6);
      this.fs.draw();
    }
    gl.disable(gl.BLEND);
    // 7 ── final
    bind(gl, null);
    const pfn = this.p.final.use();
    const po = this.post;
    pfn.tex('uHDR', this.hdrF.tex[0]).tex('uBloom', B0[0].tex[0]).f('uBloomK', po.bloom).f('uExpo', po.expo)
      .f('uTime', time).f('uVig', po.vig).f('uFlash', ...po.flash).f('uFade', po.fade).f('uSat', po.sat);
    this.fs.draw();
  }

  // world ↔ screen (CSS pixels)
  view(cam) { const z = cam.zoom; return [this.canvas.clientWidth / z, this.canvas.clientHeight / z]; }
}
