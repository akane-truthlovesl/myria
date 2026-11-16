// Thin, explicit WebGL2 helpers. No magic — just less boilerplate.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'high-performance', desynchronized: true,
  });
  if (!gl) return null;
  const ext = {
    cbf: gl.getExtension('EXT_color_buffer_float'),
    cbhf: gl.getExtension('EXT_color_buffer_half_float'),
    flin: gl.getExtension('OES_texture_float_linear'),
  };
  gl._ext = ext;
  return gl;
}

export function compile(gl, type, src, name) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(`Shader ${name} failed:\n${log}\n${lines}`);
    throw new Error(`Shader ${name}: ${log}`);
  }
  return sh;
}

export class Program {
  constructor(gl, vs, fs, name = 'prog') {
    this.gl = gl; this.name = name;
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Link ${name}: ${gl.getProgramInfoLog(p)}`);
    this.p = p; this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      this.u[nm] = gl.getUniformLocation(p, info.name);
    }
    this.texUnit = 0;
  }
  use() { this.gl.useProgram(this.p); this.texUnit = 0; return this; }
  f(n, ...v) { const l = this.u[n]; if (l == null) return this; const g = this.gl;
    if (v.length === 1) g.uniform1f(l, v[0]); else if (v.length === 2) g.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) g.uniform3f(l, v[0], v[1], v[2]); else g.uniform4f(l, v[0], v[1], v[2], v[3]); return this; }
  i(n, v) { const l = this.u[n]; if (l != null) this.gl.uniform1i(l, v); return this; }
  v4(n, arr) { const l = this.u[n]; if (l != null) this.gl.uniform4fv(l, arr); return this; }
  v2(n, arr) { const l = this.u[n]; if (l != null) this.gl.uniform2fv(l, arr); return this; }
  v1(n, arr) { const l = this.u[n]; if (l != null) this.gl.uniform1fv(l, arr); return this; }
  tex(n, tex, target) {
    const l = this.u[n]; if (l == null) return this;
    const g = this.gl; const unit = this.texUnit++;
    g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(target || g.TEXTURE_2D, tex); g.uniform1i(l, unit);
    return this;
  }
}

export function texture(gl, w, h, opts = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const internal = opts.internal ?? gl.RGBA16F, format = opts.format ?? gl.RGBA, type = opts.type ?? gl.HALF_FLOAT;
  const mips = !!opts.mips;
  if (mips) {
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, internal, w, h);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, opts.data ?? null);
  }
  const filt = opts.filter ?? gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrap ?? gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrap ?? gl.CLAMP_TO_EDGE);
  t.w = w; t.h = h; t.mips = mips;
  return t;
}

export function fbo(gl, textures) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  const bufs = [];
  textures.forEach((t, k) => {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0);
    bufs.push(gl.COLOR_ATTACHMENT0 + k);
  });
  gl.drawBuffers(bufs);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete ' + st);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  f.w = textures[0].w; f.h = textures[0].h; f.tex = textures;
  return f;
}

export function bind(gl, target) {
  if (!target) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); return; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.viewport(0, 0, target.w, target.h);
}

// Full-screen triangle
export function fullscreen(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); } };
}

// Instanced quad batch with a packed float instance buffer.
export function instanced(gl, floatsPerInstance, layout, capacity) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * floatsPerInstance * 4, gl.DYNAMIC_DRAW);
  let off = 0;
  layout.forEach((size, k) => {
    gl.enableVertexAttribArray(k + 1);
    gl.vertexAttribPointer(k + 1, size, gl.FLOAT, false, floatsPerInstance * 4, off * 4);
    gl.vertexAttribDivisor(k + 1, 1);
    off += size;
  });
  gl.bindVertexArray(null);
  const data = new Float32Array(capacity * floatsPerInstance);
  return {
    data, n: 0, fpi: floatsPerInstance, cap: capacity,
    reset() { this.n = 0; },
    push(...v) { if (this.n >= this.cap) return; const o = this.n * this.fpi; for (let k = 0; k < v.length; k++) data[o + k] = v[k]; this.n++; },
    draw() {
      if (this.n === 0) return;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, ib);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, this.n * this.fpi);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    },
  };
}
