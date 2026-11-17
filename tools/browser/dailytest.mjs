// The day's challenges: the mutation calendar, the day's dive, the day's sprint, the day's rain, the Today panel.   node dailytest.mjs
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/index.html?all', { w: 1100, h: 700 });
const play = async (pred = 'true') => { for (let k = 0; k < 120; k++) { const ok = await page.evaluate((pred) => { const a = window.__app; return !!a && a.state === 'play' && a.world.listener === a.mode && a.world.roomTime > 0.8 && !!eval(pred); }, pred); if (ok) return true; await sleep(250); } return false; };
await sleep(500); await page.mouse.click(550, 350); await play();
// 1 · the calendar: a year of days
const cal = await page.evaluate(() => { const D = window.__daily; const seen = {}, sprint = {}, rooms = {}; let doubles = 0, clash = 0, weekdaysDouble = 0; const CL = [['thick', 'swift'], ['thick', 'glide'], ['feast', 'famine'], ['feast', 'giants']];
  for (let k = 0; k < 365; k++) { const d = new Date(Date.UTC(2026, 0, 1 + k)), day = d.toISOString().slice(0, 10), ax = D.dailyAxioms(day), sp = D.dailySprint(day); for (const a of ax) seen[a.id] = (seen[a.id] || 0) + 1; if (ax.length === 2) { doubles++; if (d.getUTCDay() % 6) weekdaysDouble++; if (ax[0] === ax[1] || CL.some(c => c.includes(ax[0].id) && c.includes(ax[1].id))) clash++; } sprint[sp.m.id] = (sprint[sp.m.id] || 0) + 1; rooms[sp.i] = 1; }
  const same = JSON.stringify(D.dailyAxioms('2026-11-16').map(a => a.id)) === JSON.stringify(D.dailyAxioms('2026-11-16').map(a => a.id)); return { seen, kinds: Object.keys(seen).length, doubles, clash, weekdaysDouble, sprint, rooms: Object.keys(rooms).length, same, mon: D.dailyAxioms('2026-11-16').map(a => a.name), sat: D.dailyAxioms('2026-11-21').map(a => a.name), sp: (() => { const q = D.dailySprint('2026-11-16'); return [q.i, q.m.id]; })() }; });
console.log(`calendar 2026: ${cal.kinds} different mutations of the world all turn up (${Object.entries(cal.seen).map(([k, v]) => k + ' ' + v).join(', ')})`);
console.log(`  weekends double up: ${cal.doubles} two-mutation days, ${cal.weekdaysDouble} of them on weekdays, ${cal.clash} self-cancelling pairs · e.g. Mon 16 Nov: ${cal.mon.join(' + ')} · Sat 21 Nov: ${cal.sat.join(' + ')}`);
console.log(`  sprints: ${cal.rooms} different chambers over the year, mutations ${JSON.stringify(cal.sprint)}`);
// 2 · the Today panel, from the Atrium
const panel = await page.evaluate(() => { const a = window.__app; window.__daily.dailyPanel(a); return [...document.querySelectorAll('.h-panel button, .panel button, button')].map(b => b.textContent.trim()).filter(t => /Dive|Sprint|Rain|Back|Copy/.test(t)); });
console.log('Today panel offers:', JSON.stringify(panel)); await page.evaluate(() => window.__app.hud.closePanel());
// 3 · the day's dive really is bent
await page.evaluate(() => { const a = window.__app; a.extraModes.find(m => m.id === 'abyss').start(a, { daily: true }); }); await play('a.mode.axioms');
const dive = await page.evaluate(() => { const a = window.__app, m = a.mode, D = window.__daily; const want = D.dailyAxioms(new Date().toISOString().slice(0, 10)).map(q => q.id); return { is: m.axioms.map(q => q.id), want, name: m.axiom.name, daily: m.daily, haunting: !!m.haunting, drag: a.world.phys.drag, speed: a.world.speedScale, ents: [...new Set(a.world.ents.map(e => e.d.type))].join(',') }; });
console.log('the day\'s dive:', JSON.stringify(dive));
// 4 · the day's sprint: played to the end by the autopilot, timed, kept as the day's best — and not written into the chamber's own record
await page.goto('http://myria.test/index.html?mode=sprint&day=2026-11-16&bot', { waitUntil: 'load' }); await sleep(500); await page.mouse.click(550, 350); await play('a.mode.sprint');
const s0 = await page.evaluate(() => { const a = window.__app, m = a.mode, W = a.world; return { room: m.room.name, mut: m.sprint.m.id, drag: W.phys.drag, speed: W.speedScale, need: (W.ents.find(e => e.d.type === 'pore') || {}).need, total: W.stats.motesTotal, title: document.body.innerText.includes("sprint") }; });
console.log('the day\'s sprint (16 Nov):', JSON.stringify(s0));
let done = null; for (let k = 0; k < 400; k++) { done = await page.evaluate(() => { const a = window.__app; return a.save.get('sprintDay', '') === '2026-11-16' ? { best: a.save.get('sprintBest', 0), mode: a.mode.constructor.name, rooms: JSON.stringify(a.save.data.rooms || {}) } : null; }); if (done) break; await sleep(250); }
console.log('finished:', JSON.stringify(done && { best: done.best, back_in: done.mode, chamber_record_untouched: done.rooms === '{}' }));
// 5 · the day's rain: the same figures, in the same order and the same places, whoever plays it and however — the autopilot eating everything, or nobody at all
const rainSeq = async (day, bot) => {
  await page.goto(`http://myria.test/index.html?mode=rain&day=${day}&turbo=3${bot ? '&bot' : ''}`, { waitUntil: 'load' }); await sleep(500); await page.mouse.click(550, 350); await page.mouse.move(1090, 690); await play('a.mode.daily');
  for (let k = 0; k < 240; k++) { const q = await page.evaluate(() => { const m = window.__app.mode; return m.seq.length >= 8 ? { seq: m.seq.slice(0, 8), daily: m.daily, eaten: m.eaten } : null; }); if (q) return q; await sleep(250); }
  return null;
};
const rA = await rainSeq('2026-11-16', true), rB = await rainSeq('2026-11-16', false), rC = await rainSeq('2026-11-17', true);
console.log('the day\'s rain (16 Nov), autopilot:', JSON.stringify(rA)); console.log('the day\'s rain (16 Nov), nobody playing:', JSON.stringify(rB)); console.log('the next day\'s rain:', JSON.stringify(rC && rC.seq.slice(0, 3)));
const rainOk = !!(rA && rB && rC) && rA.daily === '2026-11-16' && rA.eaten > rB.eaten && JSON.stringify(rA.seq) === JSON.stringify(rB.seq) && JSON.stringify(rA.seq) !== JSON.stringify(rC.seq);
console.log('the same rain for everyone:', rainOk);
const mutOk = s0.mut === 'swift' ? s0.speed > 1.2 : s0.mut === 'thick' ? s0.drag > 2 : s0.mut === 'glide' ? s0.drag < 1 : s0.need === s0.total;
const ok = cal.kinds === 15 && cal.clash === 0 && cal.weekdaysDouble === 0 && cal.doubles >= 100 && cal.same && cal.mon.length === 1 && cal.sat.length === 2 && cal.rooms >= 15 && panel.some(t => /^Dive/.test(t)) && panel.some(t => /^Sprint/.test(t)) && panel.some(t => /^Rain/.test(t)) && rainOk
  && dive.daily && JSON.stringify(dive.is) === JSON.stringify(dive.want) && !dive.haunting && mutOk && done && done.best > 1 && done.rooms === '{}';
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'DAILY OK' : 'DAILY FAILED'); await browser.close();
