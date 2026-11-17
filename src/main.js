import { packHaunt, unpackHaunt, hauntName } from './core/haunt.js';
// ─────────────────────────────────────────────────────────────────────────────
//  MYRIA — boot
// ─────────────────────────────────────────────────────────────────────────────
import { App } from './app.js';
import { Hub } from './modes/hub.js';
import { Odyssey, dailySprint } from './modes/odyssey.js';
import { dailyAxioms } from './world/abyss.js';
import { Abyss } from './modes/abyss.js';
import { Pool } from './modes/pool.js';
import { Duet } from './modes/duet.js';
import { Epilogue } from './modes/epilogue.js';
import { Bloom } from './modes/bloom.js';
import { ROOMS } from './world/odyssey.js';
import { Workshop, Trial } from './modes/workshop.js';
import { packChamber, unpackChamber, chamberHash, chamberName } from './world/workshop.js';
import { shelf } from './core/shelf.js';
import { STARTERS } from './world/starters.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
let app;
try { app = new App(canvas, document.getElementById('ui'), params); }
catch (err) { document.getElementById('ui').innerHTML = `<div class="fatal">MYRIA could not start.<br><small style="opacity:.6">${err.message}</small></div>`; throw err; }
app.toHub = (o) => app.setMode(new Hub(app, o));
app.startOdyssey = (i, o) => app.setMode(new Odyssey(app, i, o));
app.toEpilogue = (o) => app.setMode(new Epilogue(app, o));
const all = params.has('all');
const today = () => new Date().toISOString().slice(0, 10);
// Today: the day's dive (one mutation of the world; two at once on a weekend) and the day's sprint (one chamber, one mutation of its water, against the clock).
// Both are the same for everyone, made from the date alone — so a result can be compared with anyone's.
function dailyPanel(a) {
  const day = today(), ax = dailyAxioms(day), sp = dailySprint(day), save = a.save; const dove = save.get('dailyDay', '') === day, ran = save.get('sprintDay', '') === day;
  const line = () => `MYRIA · ${day}\nDive — ${ax.map(q => q.name).join(' + ')}${dove ? ': ✦ ' + save.get('dailyBest', 0) : ''}\nSprint — ${ROOMS[sp.i].name} · ${sp.m.name}${ran ? ': ' + save.get('sprintBest', 0).toFixed(1) + ' s' : ''}`;
  a.hud.panel('Today', day, [
    { label: `Dive — ${ax.map(q => q.name).join(' + ')}${dove ? ` <small style="opacity:.6">&nbsp; ✦ ${save.get('dailyBest', 0)}</small>` : ''}`, cls: 'pri', fn: () => { a.hud.closePanel(); a.setMode(new Abyss(a, { daily: true })); } },
    { label: `Sprint — ${ROOMS[sp.i].name} · ${sp.m.name}${ran ? ` <small style="opacity:.6">&nbsp; ${save.get('sprintBest', 0).toFixed(1)} s</small>` : ''}`, fn: () => { a.hud.closePanel(); a.setMode(new Odyssey(a, sp.i, { single: true, sprint: sp })); } },
    ...(dove || ran ? [{ label: 'Copy today', fn: (b) => { a.copyText(line()); b.textContent = 'Copied ✓'; } }] : []),
    { label: 'Back', fn: () => { a.hud.closePanel(); a.toHub({ awake: true }); } }],
    `<div class="sub" style="line-height:1.7">${ax.map(q => q.sub).join(' · ')}<br>${sp.m.sub}</div>`);
}
// The Pool's door: the kneading pool itself — or the Workshop: make a chamber, play it through, and hand it to anyone as a line of text;
// or play one someone handed you (its record comes with it, as a blue bead to race)
const small = (t) => `<small style="opacity:.6;letter-spacing:.1em;text-transform:none">&nbsp; ${t}</small>`;
function poolPanel(a) {
  const b = shelf.bench(), made = b && b.design && b.design.items && b.design.items.length, n = shelf.gifts().length + STARTERS.length;
  a.hud.panel('Pool', 'nothing to win — unless you make something to win', [
    { label: `Knead${small('pour · drop · play')}`, cls: 'pri', fn: () => { a.hud.closePanel(); a.setMode(new Pool(a)); } },
    { label: `Workshop${small(b && b.sealed && b.sealed.h === chamberHash(b.design) ? chamberName(b.sealed.h) + ' · sealed' : made ? 'back to your chamber' : 'make a chamber')}`, fn: () => { a.hud.closePanel(); a.setMode(new Workshop(a)); } },
    { label: `Play a chamber${small(n + ' waiting')}`, fn: () => chambersPanel(a) },
    { label: 'Back', fn: () => { a.hud.closePanel(); a.toHub({ awake: true }); } }]);
}
// every chamber you could play: a line someone hands you now, the ones handed to you before, and the ones someone left on the bench —
// each with the record it carries and, once you have played it, your own best
function chambersPanel(a) {
  const play = (c) => { a.hud.closePanel(); a.setMode(new Trial(a, { design: c.design, run: c.run })); };
  const row = (c, note) => { const h = chamberHash(c.design), mine = shelf.run(h); return { label: `${chamberName(h)}${small([c.run ? c.run.t.toFixed(1) + ' s to beat' : 'no record yet', mine ? 'yours ' + mine.t.toFixed(1) + ' s' : '', note].filter(Boolean).join(' · '))}`, fn: () => play(c) }; };
  const gifts = shelf.gifts().slice().reverse().map(g => unpackChamber(g.code)).filter(Boolean), left = STARTERS.map(unpackChamber).filter(Boolean);
  a.hud.panel('Play a chamber', 'made on someone\'s bench', [
    { label: 'Paste a line someone gave you', cls: 'pri', fn: async (btn) => { const c = unpackChamber(await pasted(/MYRIA-CHAMBER\./, 'Paste a chamber')); if (!c) { btn.textContent = 'no chamber in that — copy one first'; return; } play(c); } },
    ...gifts.map(c => row(c, 'handed to you')), ...left.map(c => row(c, 'left on the bench')),
    { label: 'Back', fn: () => poolPanel(a) }]);
  a.hud.veil.querySelector('.panel').classList.add('wide');
}
// Duet: two players on one screen (pointer + keys) — or on two devices over a Link (core/link.js): no server, the two find each other by passing two lines of text.
function duetPanel(a) {
  const L = a.link, back = () => { a.hud.closePanel(); a.toHub({ awake: true }); };      // (the door has been taken: the Atrium is entered afresh)
  a.hud.panel('Duet', L.live ? 'linked — the other device is player two' : a.input.device === 'touch' ? 'two on one glass — a half each' : 'pointer  +  W A S D · Space · F', [
    { label: 'Together — dive the abyss as two', cls: 'pri', fn: () => { a.hud.closePanel(); a.setMode(new Abyss(a, { coop: true })); } },
    { label: 'Versus — a match of five little games', fn: () => { a.hud.closePanel(); a.setMode(new Duet(a)); } },
    { label: `Versus a neighbour — the machine plays Tide${(() => { const r = a.save.get('duetAI', null); return r ? ` · you ${r.w}, it ${r.l}` : ''; })()}`, fn: () => { a.hud.closePanel(); a.setMode(new Duet(a, { ai: true })); } },
    ...(L.available ? (L.live ? [{ label: 'Unlink', fn: () => { L.close(); duetPanel(a); } }] : [[{ label: 'Link · host', fn: () => linkHost(a) }, { label: 'Link · join', fn: () => linkJoin(a) }]]) : []),
    { label: 'Back', fn: back }],
    L.available && !L.live ? '<div class="sub" style="opacity:.7;max-width:30em;margin:6px auto 0">Link: play across two devices on the same network. No server — you hand each other two lines of text.</div>' : '');
}
const linkBox = (code) => `<textarea readonly onclick="this.select()" style="width:min(30em,80vw);height:5.2em;margin:10px auto 2px;display:block;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px;font:11px/1.3 ui-monospace,monospace;word-break:break-all;resize:none">${code}</textarea>`;
async function pasted(re, ask) { let txt = ''; try { if (navigator.clipboard && window.isSecureContext) txt = await navigator.clipboard.readText(); } catch (_) { txt = ''; } if (!re.test(txt)) { try { txt = window.prompt(ask) || ''; } catch (_) { txt = ''; } } return txt; }
async function linkHost(a) {
  const L = a.link; a.hud.panel('Link · host', 'making your line…', [{ label: 'Cancel', fn: () => { L.close(); duetPanel(a); } }]);
  let code = ''; try { code = await L.offer(); } catch (_) { code = ''; } if (!code) { a.hud.toast('this browser cannot link', '⇄', 'cool'); duetPanel(a); return; }
  const step2 = () => a.hud.panel('Link · host', '1 · send this line to the other device &nbsp;·&nbsp; 2 · paste the line it sends back', [
    { label: 'Copy my line', cls: 'pri', fn: (b) => { a.copyText(code); b.textContent = 'Copied ✓'; } },
    { label: 'Paste their answer', fn: async (b) => { const ok = await L.accept(await pasted(/MYRIA-LINK\.A\./, 'Paste the answer line')); if (!ok) { b.textContent = 'that is not an answer line — try again'; return; } b.textContent = 'joining…'; } },
    { label: 'Cancel', fn: () => { L.close(); duetPanel(a); } }], linkBox(code));
  L.onchange = (st) => { if (st === 'live') { L.onchange = null; duetPanel(a); } }; step2();
}
async function linkJoin(a) {
  const L = a.link; const offer = await pasted(/MYRIA-LINK\.O\./, 'Paste the host\'s line'); let code = null; try { code = await L.join(offer); } catch (_) { code = null; }
  if (!code) { a.hud.toast('that is not a host\'s line', '⇄', 'cool'); duetPanel(a); return; }
  L.onchange = (st) => { if (st === 'live' || st === 'idle') L.onchange = null; if (st === 'idle') a.hud.closePanel(); };
  a.hud.panel('Link · join', 'send this line back to the host — the picture arrives when they paste it', [{ label: 'Copy my answer', cls: 'pri', fn: (b) => { a.copyText(code); b.textContent = 'Copied ✓'; } }, { label: 'Cancel', fn: () => { L.close(); a.hud.closePanel(); a.toHub({ awake: true }); } }], linkBox(code));
}
app.extraModes = [
  { id: 'abyss', name: 'Abyss', col: [0.86, 0.6, 1.0], get sub() { const b = app.save.get('abyssBest', 0); return b ? `endless · best ${b}` : 'endless descent'; }, lock: 'light a chamber first', unlock: (n) => all || n >= 1, start: (a, o) => a.setMode(new Abyss(a, o)) },
  { id: 'daily', name: 'Daily', col: [0.5, 1.0, 0.7], get sub() { const ax = dailyAxioms(today()); return app.save.get('dailyDay', '') === today() ? `today · ${app.save.get('dailyBest', 0)} ✦` : ax.map(a => a.name).join(' + '); }, lock: 'light a chamber first', unlock: (n) => all || n >= 1, start: (a) => dailyPanel(a) },
  { id: 'bloom', name: 'Bloom', col: [1.0, 0.82, 0.42], get sub() { const b = app.save.get('bloomBest', 0); return b ? `best ${b}` : 'a minute of rain'; }, unlock: (n) => all || n >= 1, start: (a, o) => a.setMode(new Bloom(a, o)) },
  { id: 'pool', name: 'Pool', col: [0.8, 0.72, 1.0], sub: 'knead · pour · make', unlock: (n) => all || n >= 1, start: (a) => poolPanel(a) },
  { id: 'duet', name: 'Duet', col: [1.0, 0.6, 0.75], get sub() { return app.link.live ? 'linked · two devices' : 'two players · one screen, or two'; }, unlock: (n) => all || n >= 1, start: (a) => duetPanel(a) },
];
window.__app = app; window.__R = app.R; window.__rooms = ROOMS.length; window.__haunt = { packHaunt, unpackHaunt, hauntName }; window.__daily = { dailyAxioms, dailySprint, dailyPanel }; window.__ws = { packChamber, unpackChamber, chamberHash, chamberName, shelf, poolPanel, chambersPanel, Workshop, Trial, STARTERS }; window.__duet = { duetPanel, linkHost, linkJoin };
const m = params.get('mode');
if (params.has('room')) app.start(new Odyssey(app, +params.get('room') || 0, { mass: +(params.get('mass') || 0) }));
else if (m === 'abyss' || m === 'daily') app.start(new Abyss(app, { daily: m === 'daily' }));
else if (m === 'sprint') { const sp = dailySprint(params.get('day') || today()); app.start(new Odyssey(app, sp.i, { single: true, sprint: sp })); }
else if (m === 'pool') app.start(new Pool(app));
else if (m === 'workshop') app.start(new Workshop(app));
else if (params.has('chamber') && unpackChamber(params.get('chamber'))) { const c = unpackChamber(params.get('chamber')); app.start(new Trial(app, { design: c.design, run: c.run })); }      // a chamber as a link: index.html?chamber=MYRIA-CHAMBER.…
else if (m === 'bloom') app.start(new Bloom(app));
else if (m === 'myriad') app.start(new Epilogue(app));
else if (m === 'duet') app.start(new Duet(app, { ai: params.has('ai'), first: params.get('round') || '', only: params.has('only') }));
else if (m === 'coop') app.start(new Abyss(app, { coop: true }));
else app.start(new Hub(app, { awake: params.has('awake') }));
