// One command that re-runs every check this project relies on, and says plainly what passed:
//   node tools/verify.mjs            the whole battery (about half an hour on a slow shared machine)
//   node tools/verify.mjs quick      physics laws + six chambers + browser smoke (a few minutes)
// Nothing here opens a network listener: the browser checks serve files by request interception.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quick = process.argv[2] === 'quick';
const run = (args, cwd = ROOT) => { const r = spawnSync('node', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }); return (r.stdout || '') + (r.stderr || ''); };
const rows = []; const t00 = Date.now();
const check = (name, fn) => { const t0 = Date.now(); let ok = false, note = ''; try { [ok, note] = fn(); } catch (e) { note = String(e.message || e).slice(0, 160); } rows.push([ok, name, note, ((Date.now() - t0) / 1000).toFixed(0) + ' s']); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  —  ${note}`); };
const last = (out, n = 1) => out.trim().split('\n').slice(-n).join(' | ');

check('build (single-file index.html, no warnings)', () => { const o = run(['tools/build.mjs']); const warn = (o.match(/\[WARNING\][^\n]*/g) || []); return [/index\.html\s+\d+ KB/.test(o) && !warn.length, warn.length ? warn.join(' · ') : last(o)]; });
check('eight physics laws, measured', () => { const o = run(['tools/axioms.mjs']); const n = (o.match(/^PASS/gm) || []).length; return [/all laws hold/.test(o), `${n} measurements pass`]; });
check('generator: no light is born inside a wall (Abyss, 176 rooms)', () => { const o = run(['tools/embedded.mjs', '22', '9']); const m = /(\d+) rooms, (\d+) lights: (\d+) inside a wall, (\d+) flush/.exec(o); return [!!m && m[3] === '0' && +m[4] <= 0.002 * +m[2], m ? `${m[2]} lights in ${m[1]} rooms: ${m[3]} inside a wall, ${m[4]} flush against one` : last(o)]; });
const solve = (a, b, w, h) => { const o = run(['tools/solve.mjs', String(a), String(b), String(w), String(h), '1']); const done = (o.match(/ DONE /g) || []).length; const m = /total .*?(\d+) unfinished/.exec(o); return [!!m && m[1] === '0' && done === b - a + 1, `${done}/${b - a + 1} chambers finished by the bot at ${w}×${h}`]; };
if (quick) check('bot plays chambers 0, 7, 13, 14, 24, 26 (landscape)', () => { let ok = true, n = 0; for (const i of [0, 7, 13, 14, 24, 26]) { const [k] = solve(i, i, 1280, 720); ok = ok && k; n += k ? 1 : 0; } return [ok, `${n}/6 finished`]; });
else { check('bot plays every chamber, landscape', () => solve(0, 27, 1280, 720)); check('bot plays every chamber, portrait', () => solve(0, 27, 900, 1060)); }
const B = path.join(ROOT, 'tools', 'browser');
check('browser: opens from file://', () => { const o = run(['filetest.mjs'], B); return [/"state":"play"/.test(o), last(o).slice(0, 110)]; });
check('browser: first three seconds on a new save (mouse)', () => { const o = run(['ftue.mjs', '1280', '720', '0'], B); return [/FTUE OK/.test(o) && /no console errors/.test(o), last(o, 3).slice(0, 150)]; });
check('browser: first three seconds on a new save (touch stick)', () => { const o = run(['ftue.mjs', '480', '860', '1'], B); return [/FTUE OK/.test(o) && /no console errors/.test(o), last(o, 3).slice(0, 150)]; });
check('browser: touch gestures (stick, tap-dart, bud, swell, pinch-rally)', () => { const o = run(['touchtest.mjs'], B); return [/pinch → rally.*"orgs":1/.test(o) && /no console errors/.test(o), 'stick · dart · bud · swell · rally all answered']; });
check('browser: optional gyro tilt', () => { const o = run(['tilttest.mjs'], B); return [/TILT OK/.test(o) && /no console errors/.test(o), last(o, 2)]; });
check('browser: two players on one screen (Duet and co-op dive; keys, and two thumbs on one phone)', () => { const o = run(['duettest.mjs'], B); return [/DUET OK/.test(o), last(o, 3).slice(0, 200)]; });
check('browser: a Duet match against the machine (crown · race · spark · rain · masks, cards between, a panel at the end)', () => { const o = run(['duetmatch.mjs'], B); return [/DUET MATCH OK/.test(o), (/"why":\[[^\]]*\]/.exec(o) || [''])[0].slice(0, 160) + ' ' + ((/"seen":\{.*?\}\}/.exec(o) || [''])[0].slice(0, 200) || last(o))]; });
check('browser: a door for two (the dive together: sealed until both pads are held at once)', () => { const o = run(['twintest.mjs'], B); return [/TWIN OK/.test(o), last(o, 2).slice(0, 220)]; });
check('browser: Masks on one keyboard (all alike · split keys · a stranger unmasks you · a tag · four lights)', () => { const o = run(['maskstest.mjs'], B); return [/MASKS OK/.test(o), (/"why":\[[^\]]*\]/.exec(o) || [''])[0].slice(0, 200) + ' ' + ((/"card":"[^"]*"/.exec(o) || [''])[0]) || last(o)]; });
check('browser: Bloom (figures on threads, drawn whole and etched into the plate, the multiplier\'s steps, a quiet chain, a blade\'s cut, the garden at the end)', () => { const o = run(['bloomtest.mjs'], B); return [/BLOOM OK/.test(o), (/"why":\[[^\]]*\]/.exec(o) || [''])[0].slice(0, 160) + ' ' + ((/"end":\{[^}]*\}/.exec(o) || [''])[0].slice(0, 180)) || last(o)]; });
check('browser: Link — two browsers paired by two lines of text, no server', () => { const o = run(['linktest.mjs'], B); return [/LINK OK/.test(o), (/guest points[^\n]*/.exec(o) || [''])[0].slice(0, 170)]; });
check('browser: echo (ghost on replay, share code)', () => { const o = run(['echotest.mjs'], B); return [/ECHO OK/.test(o) && /no console errors/.test(o), last(o, 2)]; });
check('browser: a stranger told nothing (random pointer, new save)', () => { const o = run(['stranger.mjs', quick ? '3' : '5', '0'], B); return [/STRANGER OK/.test(o), last(o, 4).split(' | ')[0].slice(0, 190)]; });
if (!quick) check('browser: a stranger told nothing (random thumb, phone)', () => { const o = run(['stranger.mjs', '5', '1', '480', '860'], B); return [/STRANGER OK/.test(o), last(o, 4).split(' | ')[0].slice(0, 190)]; });
check('browser: sandbox (two-finger strand, bubbles, weight, pour, drop)', () => { const o = run(['sandbox.mjs'], B); return [/SANDBOX OK/.test(o), 'kneaded into a strand · bubbles swallowed and breathed out · poured · dropped']; });
check('browser: hauntings (left, found, raised, laid to rest, handed over as text)', () => { const o = run(['haunttest.mjs'], B); return [/HAUNT OK/.test(o), (/its line of text: (\S+)/.exec(o) || [])[1] || last(o)]; });
check('browser: album (a first trick and a warden kept as pictures, shown in the Atrium)', () => { const o = run(['albumtest.mjs'], B); return [/ALBUM OK/.test(o), (/Atrium: [^\n]*/.exec(o) || [''])[0].slice(0, 120)]; });
check('made chambers: the four left on the bench can be finished (autopilot, through the real Trial mode, both orientations)', () => { const a = run(['tools/chambers.mjs', '1280', '720', '1']), b = run(['tools/chambers.mjs', '900', '1060', '1']); const ok = /total 4 chambers, 0 unfinished/.test(a) && /total 4 chambers, 0 unfinished/.test(b); return [ok, ok ? (a.match(/DONE t=\s*[0-9.]+/g) || []).map(q => q.replace(/DONE t=\s*/, '')).join(' · ') + ' s (landscape)' : last(a) + ' | ' + last(b)]; });
check('browser: workshop (paint, draw, set down, erase, undo · play · seal · a line of text · a stranger races the maker)', () => { const o = run(['workshoptest.mjs'], B); return [/WORKSHOP OK/.test(o), (/"sealed":\{[^}]*\}/.exec(o) || [''])[0].slice(0, 120) || last(o)]; });
check('browser: daily dive + daily sprint (mutation calendar, Today panel)', () => { const o = run(['dailytest.mjs'], B); return [/DAILY OK/.test(o), (/calendar[^\n]*/.exec(o) || [''])[0].slice(0, 110)]; });
check('sound and haptics, measured (36 voices, tension hum, tremors)', () => { const o = run(['senses.mjs'], B); return [/SENSES OK/.test(o), (/tension hum:[^\n]*/.exec(o) || [''])[0].slice(0, 150)]; });
if (!quick) check('browser: every mode opens and runs; Atrium menus', () => { const o = run(['modes.mjs', '5'], B); const n = (o.match(/^ok /gm) || []).length; return [/MODES OK/.test(o), `${n} modes and menus alive, no console errors`]; });
if (!quick) check('browser: every chamber loads and runs (autopilot soak)', () => { const o = run(['soak.mjs', '2500'], B); const n = (o.match(/state=play/g) || []).length; return [n === 28 && /no console errors/.test(o), `${n}/28 chambers in play, ${/no console errors/.test(o) ? 'no console errors' : 'console errors!'}`]; });
if (!quick) check('abyss: nine depths, careless pilot, no deaths', () => { mkdirSync(path.join(ROOT, '.verify'), { recursive: true }); const o = run(['tools/abyss.mjs', path.join(ROOT, '.verify', 'abyss'), '1280', '720', '9', '30', '31337', 'naive']); const d = (o.match(/deaths=(\d+)/g) || []).map(s => +s.slice(7)); return [d.length === 9 && d.every(x => x === 0), `${d.length} depths, deaths ${d.join(',')}`]; });

const bad = rows.filter(r => !r[0]).length;
console.log(`\n${rows.length - bad}/${rows.length} checks passed in ${((Date.now() - t00) / 60000).toFixed(1)} min${bad ? ' — ' + bad + ' FAILED' : ''}`);
process.exit(bad ? 1 : 0);
