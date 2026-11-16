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
    { label: 'Back', fn: () => a.hud.closePanel() }],
    `<div class="sub" style="line-height:1.7">${ax.map(q => q.sub).join(' · ')}<br>${sp.m.sub}</div>`);
}
app.extraModes = [
  { id: 'abyss', name: 'Abyss', col: [0.86, 0.6, 1.0], get sub() { const b = app.save.get('abyssBest', 0); return b ? `endless · best ${b}` : 'endless descent'; }, lock: 'light a chamber first', unlock: (n) => all || n >= 1, start: (a, o) => a.setMode(new Abyss(a, o)) },
  { id: 'daily', name: 'Daily', col: [0.5, 1.0, 0.7], get sub() { const ax = dailyAxioms(today()); return app.save.get('dailyDay', '') === today() ? `today · ${app.save.get('dailyBest', 0)} ✦` : ax.map(a => a.name).join(' + '); }, lock: 'light a chamber first', unlock: (n) => all || n >= 1, start: (a) => dailyPanel(a) },
  { id: 'bloom', name: 'Bloom', col: [1.0, 0.82, 0.42], get sub() { const b = app.save.get('bloomBest', 0); return b ? `best ${b}` : 'a minute of rain'; }, unlock: () => true, start: (a, o) => a.setMode(new Bloom(a, o)) },
  { id: 'pool', name: 'Pool', col: [0.8, 0.72, 1.0], sub: 'knead · pour · play', unlock: () => true, start: (a, o) => a.setMode(new Pool(a, o)) },
  { id: 'duet', name: 'Duet', col: [1.0, 0.6, 0.75], sub: 'two players · one screen', unlock: () => true, start: (a) => a.hud.panel('Duet', 'pointer  +  W A S D · Space · F', [{ label: 'Together — dive the abyss as two', cls: 'pri', fn: () => { a.hud.closePanel(); a.setMode(new Abyss(a, { coop: true })); } }, { label: 'Versus — ninety seconds of rain', fn: () => { a.hud.closePanel(); a.setMode(new Duet(a)); } }, { label: 'Back', fn: () => { a.hud.closePanel(); a.toHub({ awake: true }); } }]) },
];
window.__app = app; window.__R = app.R; window.__rooms = ROOMS.length; window.__haunt = { packHaunt, unpackHaunt, hauntName }; window.__daily = { dailyAxioms, dailySprint, dailyPanel };
const m = params.get('mode');
if (params.has('room')) app.start(new Odyssey(app, +params.get('room') || 0, { mass: +(params.get('mass') || 0) }));
else if (m === 'abyss' || m === 'daily') app.start(new Abyss(app, { daily: m === 'daily' }));
else if (m === 'sprint') { const sp = dailySprint(params.get('day') || today()); app.start(new Odyssey(app, sp.i, { single: true, sprint: sp })); }
else if (m === 'pool') app.start(new Pool(app));
else if (m === 'bloom') app.start(new Bloom(app));
else if (m === 'myriad') app.start(new Epilogue(app));
else if (m === 'duet') app.start(new Duet(app));
else if (m === 'coop') app.start(new Abyss(app, { coop: true }));
else app.start(new Hub(app, { awake: params.has('awake') }));
