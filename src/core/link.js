// ─────────────────────────────────────────────────────────────────────────────
//  Link — two devices, one dish, no server.
//
//  The host plays the real game; its canvas (and its sound) travel to the guest
//  as a live stream, and the guest's pointer travels back as player two's will.
//  The two devices find each other with nothing but two lines of text passed by
//  hand (any messenger will do): the host's offer, the guest's answer. No ICE
//  server is named, so nothing is sent to anyone else — which also means the two
//  devices must be able to reach each other directly (the same network).
//
//    host:   code = await link.offer()      → give `code` to the guest
//            await link.accept(answerCode)  → live when the guest's answer is in
//    guest:  code = await link.join(offerCode) → give `code` back to the host
// ─────────────────────────────────────────────────────────────────────────────
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
async function pipe(u8, T) { const s = new Blob([u8]).stream().pipeThrough(T); return new Uint8Array(await new Response(s).arrayBuffer()); }
// a session description, squeezed: 'z' + deflate when the browser can, 'p' + plain otherwise
async function pack(text) { const raw = new TextEncoder().encode(text); try { if (typeof CompressionStream !== 'undefined') return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (_) { /* fall through */ } return 'p' + b64(raw); }
async function unpack(code) { const u = unb64(code.slice(1)); return new TextDecoder().decode(code[0] === 'z' ? await pipe(u, new DecompressionStream('deflate-raw')) : u); }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Link {
  constructor(app) { this.app = app; this.pc = null; this.ch = null; this.out = null; this.role = null; this.state = 'idle'; this.remote = { u: 0.5, v: 0.5, alt: 0, t: -1e9, ev: [] }; this.video = null; this.onchange = null; this.sent = 0; this.got = 0; }
  get available() { return typeof RTCPeerConnection !== 'undefined' && !!(this.app.canvas && this.app.canvas.captureStream); }
  get live() { return this.state === 'live'; }
  _set(s) { if (this.state === s) return; this.state = s; if (this.onchange) this.onchange(s); }
  _pc() {
    const pc = this.pc = new RTCPeerConnection({ iceServers: [] });
    pc.onconnectionstatechange = () => { if (pc !== this.pc) return; const s = pc.connectionState; if (s === 'connected') this._live(); else if (s === 'failed' || s === 'closed' || s === 'disconnected' && this.live) this._lost(); };
    return pc;
  }
  _gathered(pc) { return pc.iceGatheringState === 'complete' ? Promise.resolve() : new Promise(res => { const t = setTimeout(res, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }

  // ── host ──
  async offer() {
    this.close(); this.role = 'host'; const pc = this._pc(), app = this.app;
    const stream = app.canvas.captureStream(30); for (const t of stream.getVideoTracks()) { const snd = pc.addTrack(t, stream); try { const p = snd.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 2500000; p.encodings[0].scaleResolutionDownBy = Math.max(1, app.canvas.width / 1280); snd.setParameters(p).catch(() => {}); } catch (_) { /* older browsers */ } }
    try { const s = app.sound; if (s.init) s.init(); if (s.ctx && s.master) { const d = this._adest = s.ctx.createMediaStreamDestination(); s.master.connect(d); for (const t of d.stream.getAudioTracks()) pc.addTrack(t, stream); } } catch (_) { /* the picture is enough */ }
    // one codec each is all two copies of the same game need to agree on — and it makes the line of text to hand over a third as long
    try { for (const tr of pc.getTransceivers()) { const kind = tr.sender.track && tr.sender.track.kind, caps = kind && RTCRtpSender.getCapabilities(kind); if (!caps || !tr.setCodecPreferences) continue; const want = caps.codecs.filter(c => (kind === 'video' ? /\/VP8$/i : /\/opus$/i).test(c.mimeType)); if (want.length) tr.setCodecPreferences(want); } } catch (_) { /* the long line still works */ }
    const ch = this.ch = pc.createDataChannel('in'); ch.onmessage = (e) => this._input(e.data);
    this.out = pc.createDataChannel('say');
    await pc.setLocalDescription(await pc.createOffer()); await this._gathered(pc); this._set('offered');
    return 'MYRIA-LINK.O.' + await pack(pc.localDescription.sdp);
  }
  async accept(code) { const m = /MYRIA-LINK\.A\.([A-Za-z0-9_-]+)/.exec(String(code || '')); if (!m || !this.pc || this.role !== 'host') return false; try { await this.pc.setRemoteDescription({ type: 'answer', sdp: await unpack(m[1]) }); } catch (_) { return false; } this._set('joining'); return true; }
  _input(data) { let m; try { m = JSON.parse(data); } catch (_) { return; } const r = this.remote; this.got++; r.u = Math.max(0, Math.min(1, +m.u || 0)); r.v = Math.max(0, Math.min(1, +m.v || 0)); r.alt = +m.a || 0; r.t = performance.now(); if (Array.isArray(m.e)) for (const e of m.e) if (r.ev.length < 8) r.ev.push(e); }
  // player two's will, read by the modes each step: a pull toward where the far pointer is, a held breath, and the darts that were asked for
  p2(C) {
    if (!this.live || this.role !== 'host' || performance.now() - this.remote.t > 1500) return null; const F = C && C.focus; if (!F || !F.alive) return null;
    const R = this.app.R, r = this.remote, [wx, wy] = R.cssToWorld(r.u * window.innerWidth, r.v * window.innerHeight); const dx = wx - F.B.cx, dy = wy - F.B.cy, d = Math.hypot(dx, dy) + 1e-3, t = smooth(F.B.r * 0.45, F.B.r * 0.45 + 95, d);
    const darts = []; while (r.ev.length) { const e = r.ev.shift(); if (e && e.k === 'dart') darts.push({ x: dx / d, y: dy / d, power: 0.9 + Math.min(1, (+e.h || 0) / 0.7) * 0.7 }); }
    return { x: dx / d * t, y: dy / d * t, swell: r.alt > 0.26, darts };
  }
  tell(o) { if (this.out && this.out.readyState === 'open') { try { this.out.send(JSON.stringify(o)); } catch (_) { /* a dropped caption is no loss */ } } }

  // ── guest ──
  async join(code) {
    const m = /MYRIA-LINK\.O\.([A-Za-z0-9_-]+)/.exec(String(code || '')); if (!m) return null; this.close(); this.role = 'guest'; const pc = this._pc();
    pc.ontrack = (e) => this._show(e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
    pc.ondatachannel = (e) => { if (e.channel.label === 'in') this.ch = e.channel; else e.channel.onmessage = (ev) => this._said(ev.data); };
    try { await pc.setRemoteDescription({ type: 'offer', sdp: await unpack(m[1]) }); await pc.setLocalDescription(await pc.createAnswer()); } catch (_) { this.close(); return null; }
    await this._gathered(pc); this._set('answered');
    return 'MYRIA-LINK.A.' + await pack(pc.localDescription.sdp);
  }
  _show(stream) {
    if (this.video) { this.video.srcObject = stream; return; }
    const v = this.video = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.muted = true; v.srcObject = stream;
    v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#05060c;touch-action:none;z-index:2';
    document.body.insertBefore(v, document.getElementById('ui')); v.play().catch(() => {});
    // the guest's hand: where the pointer is over the picture, what it holds, what it taps
    const st = { u: 0.5, v: 0.5, t0: 0, alt0: 0, ev: [] };
    const at = (e) => { const b = v.getBoundingClientRect(), vw = v.videoWidth || 16, vh = v.videoHeight || 9, k = Math.min(b.width / vw, b.height / vh), w = vw * k, h = vh * k; st.u = Math.max(0, Math.min(1, (e.clientX - b.left - (b.width - w) / 2) / w)); st.v = Math.max(0, Math.min(1, (e.clientY - b.top - (b.height - h) / 2) / h)); };
    v.addEventListener('pointerdown', (e) => { e.preventDefault(); v.muted = false; try { v.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } at(e); if (e.button === 2 || !e.isPrimary) st.alt0 = performance.now(); else st.t0 = performance.now(); });
    v.addEventListener('pointermove', (e) => { if (e.isPrimary) at(e); });
    const up = (e) => { if (e.button === 2 || !e.isPrimary) { st.alt0 = 0; return; } if (st.t0) { st.ev.push({ k: 'dart', h: +((performance.now() - st.t0) / 1000).toFixed(2) }); st.t0 = 0; } };
    v.addEventListener('pointerup', up); v.addEventListener('pointercancel', () => { st.t0 = 0; st.alt0 = 0; }); v.addEventListener('contextmenu', (e) => e.preventDefault());
    this._pump = setInterval(() => { const c = this.ch; if (!c || c.readyState !== 'open') return; c.send(JSON.stringify({ u: +st.u.toFixed(4), v: +st.v.toFixed(4), a: st.alt0 ? +((performance.now() - st.alt0) / 1000).toFixed(2) : 0, e: st.ev.splice(0) })); this.sent++; }, 33);
  }
  _said(data) { let m; try { m = JSON.parse(data); } catch (_) { return; } const hud = this.app.hud; if (m.t === 'toast') hud.toast(...m.a); else if (m.t === 'title') hud.showTitle(...m.a); else if (m.t === 'end') { hud.panel(m.title || 'The link rests', m.sub || '', [{ label: 'Stay', cls: 'pri', fn: () => hud.closePanel() }, { label: 'Leave', fn: () => { hud.closePanel(); this.close(); } }]); } }

  _live() {
    this._set('live'); const app = this.app;
    if (this.role === 'host' && !this._wrapped) {          // what the host's captions say, the guest's captions say
      this._wrapped = true; const hud = app.hud, t0 = hud.toast.bind(hud), s0 = hud.showTitle.bind(hud);
      hud.toast = (...a) => { t0(...a); if (this.live) this.tell({ t: 'toast', a }); }; hud.showTitle = (...a) => { s0(...a); if (this.live) this.tell({ t: 'title', a }); };
    }
    if (this.role === 'guest') { app.linkGuest = true; app.hud.closePanel(); app.hud.setTop(null); app.hud.hint(''); app.hud.setLabels([]); }
    app.hud.toast(this.role === 'host' ? 'linked — a second player is with you' : 'linked — move, tap to dart, hold a second finger to swell', '⇄', 'cool');
  }
  _lost() { const was = this.live; this.close(); if (was) this.app.hud.toast('the link is gone', '⇄', 'cool'); }
  close() {
    if (this._pump) { clearInterval(this._pump); this._pump = 0; } if (this.video) { this.video.remove(); this.video = null; }
    try { if (this._adest && this.app.sound.master) this.app.sound.master.disconnect(this._adest); } catch (_) { /* ignore */ } this._adest = null;
    const pc = this.pc; this.pc = null; this.ch = null; this.out = null; if (pc) { try { pc.close(); } catch (_) { /* ignore */ } }
    // a guest whose link ends wakes up in its own Atrium again
    if (this.app.linkGuest) { this.app.linkGuest = false; if (this.app.toHub) { this.app.hud.closePanel(); this.app.toHub({ awake: true }); } } this.role = null; this._set('idle');
  }
}
