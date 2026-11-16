// ─────────────────────────────────────────────────────────────────────────────
//  ODYSSEY — a wordless micro-odyssey through the drowned observatory of glass.
//  Each chamber teaches one idea purely through physical metaphor.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MAT } from '../engine/materials.js';
import { moteTrail } from '../game/entities.js';

const box = (x, y, w, h, r = 30, extra = {}) => ({ t: 'box', x, y, w, h, r, ...extra });
const carve = (s, k = 0, extra = {}) => ({ op: 'carve', k, ...s, ...extra });
const add = (s, mat = SURF.STONE, k = 0) => ({ op: 'add', mat, k, ...s });

const PAL = {
  dawn: { p0: [0.002, 0.008, 0.020], p1: [0.008, 0.034, 0.068], p2: [0.05, 0.085, 0.11], p3: [0.5, 0.85, 1.0], sky: [0.55, 0.78, 0.95] },
  teal: { p0: [0.003, 0.012, 0.016], p1: [0.010, 0.045, 0.05], p2: [0.05, 0.10, 0.10], p3: [0.5, 0.95, 0.9], sky: [0.5, 0.85, 0.85] },
  violet: { p0: [0.008, 0.006, 0.02], p1: [0.03, 0.02, 0.06], p2: [0.08, 0.07, 0.12], p3: [0.75, 0.7, 1.0], sky: [0.7, 0.65, 0.95] },
  amber: { p0: [0.014, 0.008, 0.006], p1: [0.05, 0.028, 0.02], p2: [0.11, 0.08, 0.06], p3: [1.0, 0.8, 0.6], sky: [0.95, 0.8, 0.65] },
  abyss: { p0: [0.002, 0.004, 0.01], p1: [0.008, 0.016, 0.035], p2: [0.05, 0.06, 0.09], p3: [0.6, 0.7, 1.0], sky: [0.5, 0.6, 0.9] },
  steel: { p0: [0.004, 0.006, 0.012], p1: [0.016, 0.024, 0.04], p2: [0.075, 0.085, 0.1], p3: [0.75, 0.85, 1.0], sky: [0.75, 0.82, 0.95] },
  rose: { p0: [0.012, 0.004, 0.012], p1: [0.045, 0.014, 0.04], p2: [0.11, 0.06, 0.09], p3: [1.0, 0.7, 0.85], sky: [1.0, 0.75, 0.85] },
};

export const CHAMBERS = [];

// ── I · First Light ────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'first-light', name: 'First Light', sub: 'I · dew',
  bounds: [0, 150, 2620, 900], view: 950, gravity: [0, 600], palette: PAL.dawn, key: [50, 'dawn'], amb: 'deep',
  spawn: [300, 380], mass: 120, cap: 300, par: 55,
  geo: [
    carve(box(500, 560, 900, 420, 70)),             // hall
    carve(box(1080, 745, 360, 52, 22), 18),         // the squeeze
    carve(box(1500, 560, 560, 420, 60), 18),        // grotto
    carve(box(2200, 470, 780, 300, 60), 24),        // upper gallery
    add(box(1720, 700, 300, 170, 26)),              // the step (climb it)
    add(box(2080, 540, 64, 180, 24), SURF.STONE),   // prism pillar
    add(box(640, 800, 220, 90, 40)),                // gentle hill in the hall floor
  ],
  entities: [
    ...moteTrail([[420, 735], [560, 712], [700, 700], [840, 735], [940, 745]], 8),
    ...moteTrail([[1010, 752], [1160, 752]], 3),
    ...moteTrail([[1300, 745], [1450, 745]], 3),
    ...moteTrail([[1555, 740], [1555, 650], [1640, 595]], 5),
    ...moteTrail([[1880, 595], [2010, 595]], 3),
    ...moteTrail([[2160, 595], [2300, 595]], 3),
    { type: 'prism', x: 2080, y: 418, idx: 0 },
    { type: 'prism', x: 160, y: 420, idx: 1 },
    { type: 'lantern', x: 1360, y: 742, id: 'l1' },
    { type: 'exit', x: 2470, y: 560, r: 46 },
    { type: 'hint', x: 300, y: 640, kind: 'drag', after: 2.5, r: 300 },
    { type: 'hint', x: 1560, y: 640, hx: 1560, hy: 600, kind: 'climb', after: 4, r: 200 },
  ],
});

// ── II · The Climb ────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'the-climb', name: 'The Climb', sub: 'II · cling',
  bounds: [0, -900, 1500, 900], view: 950, gravity: [0, 600], palette: PAL.teal, key: [52, 'dawn'], amb: 'deep',
  spawn: [300, 700], mass: 140, cap: 320, par: 70,
  geo: [
    carve(box(420, 700, 700, 240, 60)),                   // floor room
    carve(box(760, 120, 360, 1360, 60), 30),              // the shaft
    carve(box(1110, -580, 640, 300, 60), 30),             // summit gallery
    add(box(760, 380, 150, 40, 16), SURF.GLASS),          // slick glass shelf (cannot cling)
    add(box(700, -70, 90, 36, 14), SURF.GLASS),
    add(box(860, -300, 120, 36, 14), SURF.STONE),
    add(box(620, 160, 60, 140, 20), SURF.GLASS),          // glass strip on the left wall
    add(box(900, 520, 60, 160, 20), SURF.GLASS),          // glass strip on the right wall
  ],
  entities: [
    ...moteTrail([[360, 760], [520, 760]], 3),
    ...moteTrail([[600, 740], [612, 620], [612, 500]], 4),
    ...moteTrail([[905, 420], [905, 300], [905, 180]], 4),
    ...moteTrail([[612, 60], [612, -80], [612, -220]], 4),
    ...moteTrail([[760, -420], [900, -560], [1000, -620]], 5),
    { type: 'prism', x: 760, y: 345, idx: 0 },
    { type: 'prism', x: 860, y: -335, idx: 1 },
    { type: 'prism', x: 1400, y: -640, idx: 2 },
    { type: 'lantern', x: 900, y: 120, id: 'l1' },
    { type: 'lantern', x: 1000, y: -460, id: 'l2' },
    { type: 'exit', x: 1300, y: -600, r: 46 },
    { type: 'hint', x: 610, y: 700, hx: 640, hy: 640, kind: 'climb', after: 3, r: 260 },
  ],
});

// ── III · Leap ────────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'leap', name: 'Leap', sub: 'III · dart',
  bounds: [0, 140, 3200, 1160], view: 1000, gravity: [0, 600], palette: PAL.dawn, key: [53, 'dawn'], amb: 'deep',
  spawn: [250, 620], mass: 140, cap: 320, par: 65,
  geo: [
    carve(box(1600, 500, 3100, 640, 80)),                          // the long cave (floor y=820)
    carve(box(800, 965, 200, 330, 30), 10, { mat: SURF.GLASS }),     // chasm I (glass walls)
    carve(box(2400, 975, 400, 350, 40), 10, { mat: SURF.GLASS }),    // chasm II
    add(box(1200, 790, 600, 140, 26)),                              // raised shelf (top 720)
    add(box(1530, 705, 60, 230, 22), SURF.GLASS),                   // glass wall (top 590) — dart or bounce
    add(box(1920, 432, 170, 26, 12), SURF.GLASS),                   // prism ledge
  ],
  entities: [
    ...moteTrail([[200, 790], [560, 790]], 4),
    ...moteTrail([[640, 760], [720, 680], [800, 650], [880, 670], [960, 700]], 5),
    ...moteTrail([[1020, 700], [1280, 700]], 3),
    ...moteTrail([[1400, 650], [1470, 560], [1540, 520], [1610, 560], [1680, 640], [1720, 760]], 6),
    ...moteTrail([[1800, 790], [2100, 790]], 4),
    ...moteTrail([[2160, 740], [2280, 640], [2400, 610], [2520, 640], [2640, 740]], 5),
    ...moteTrail([[2700, 790], [2900, 790]], 3),
    { type: 'geyser', x: 800, y: 1120, w: 110, h: 470, power: 900 },
    { type: 'geyser', x: 2400, y: 1140, w: 160, h: 620, power: 980 },
    { type: 'bumper', x: 1390, y: 712, len: 110, angle: 0, rest: 1.45 },
    { type: 'bumper', x: 1760, y: 812, len: 100, angle: -0.35, rest: 1.5 },
    { type: 'prism', x: 1920, y: 398, idx: 0 },
    { type: 'prism', x: 800, y: 1090, idx: 1 },
    { type: 'prism', x: 2400, y: 330, idx: 2 },
    { type: 'lantern', x: 1100, y: 712, id: 'l1' },
    { type: 'lantern', x: 2720, y: 812, id: 'l2' },
    { type: 'exit', x: 3040, y: 740, r: 46 },
    { type: 'hint', x: 600, y: 760, hx: 640, hy: 700, kind: 'flick', after: 2.5, r: 220 },
    { type: 'hint', x: 1450, y: 700, hx: 1460, hy: 640, kind: 'flick', after: 5, r: 160 },
  ],
});

// ── IV · Two Hearts ───────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'two-hearts', name: 'Two Hearts', sub: 'IV · myriad',
  bounds: [0, 260, 2720, 980], view: 1050, gravity: [0, 600], palette: PAL.teal, key: [55, 'dawn'], amb: 'deep',
  spawn: [300, 640], mass: 150, cap: 320, par: 80,
  geo: [
    carve(box(1050, 600, 1900, 460, 70)),                 // the hall (floor 830)
    carve(box(2360, 700, 720, 260, 60), 20),              // sanctum beyond the lock
    add(box(1050, 790, 80, 170, 24)),                     // divider (climbable)
    add(box(1780, 470, 140, 26, 12), SURF.GLASS),         // high glass ledge
  ],
  entities: [
    ...moteTrail([[220, 800], [460, 800]], 3),
    ...moteTrail([[700, 800], [960, 800]], 3),
    ...moteTrail([[1150, 800], [1420, 800]], 3),
    ...moteTrail([[1680, 800], [1900, 800]], 3),
    ...moteTrail([[2150, 800], [2450, 800]], 4),
    { type: 'plate', id: 'p1', x: 560, y: 830, w: 120, need: 45 },
    { type: 'plate', id: 'p2', x: 1550, y: 830, w: 120, need: 45 },
    { type: 'gate', id: 'g1', x: 2020, y: 700, w: 36, h: 262, dy: -262, need: ['p1', 'p2'], latch: true, surf: SURF.METAL },
    { type: 'prism', x: 1050, y: 680, idx: 0 },
    { type: 'prism', x: 1780, y: 438, idx: 1 },
    { type: 'lantern', x: 2240, y: 822, id: 'l1' },
    { type: 'exit', x: 2560, y: 760, r: 46 },
    { type: 'hint', x: 560, y: 800, hx: 560, hy: 700, kind: 'bud', after: 3, r: 160, until: 'g1' },
    { type: 'hint', x: 1550, y: 800, hx: 1550, hy: 700, kind: 'swap', after: 4, r: 420, until: 'g1' },
    { type: 'hint', x: 1950, y: 800, hx: 1900, hy: 680, kind: 'rally', after: 3, r: 500, until: { fn: (G) => G.colony && G.colony.orgs.length === 1 } },
  ],
});

// ── V · The Comb ──────────────────────────────────────────────────────────
const comb = (x0, y0, x1, y1, step, r, mat = SURF.GLASS) => {
  const out = []; const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / step);
  for (let k = 0; k <= n; k++) out.push(add({ t: 'circle', x: x0 + (x1 - x0) * k / n, y: y0 + (y1 - y0) * k / n, r }, mat));
  return out;
};
CHAMBERS.push({
  id: 'the-comb', name: 'The Comb', sub: 'V · strands',
  bounds: [0, 160, 2440, 1260], view: 1050, gravity: [0, 600], palette: PAL.violet, key: [48, 'lydian'], amb: 'deep',
  spawn: [300, 420], mass: 170, cap: 340, par: 75,
  geo: [
    carve(box(600, 450, 1000, 400, 60)),                  // upper room (floor 650)
    carve(box(600, 700, 310, 120, 20)),                   // the sieve opening
    carve(box(900, 960, 1500, 400, 60), 20),              // lower room (floor 1160)
    carve(box(2040, 1040, 760, 230, 50), 16),             // exit gallery
    ...comb(462, 698, 738, 698, 34, 8),                   // sieve: glass pins
    ...comb(1650, 932, 1650, 1148, 34, 8),                // vertical comb
    add(box(220, 590, 120, 26, 12), SURF.GLASS),          // high shelf (prism)
  ],
  entities: [
    ...moteTrail([[200, 620], [420, 620]], 3),
    ...moteTrail([[480, 640], [720, 640]], 4),
    ...moteTrail([[300, 1130], [520, 1130]], 3),
    ...moteTrail([[900, 1130], [1500, 1130]], 6),
    ...moteTrail([[1750, 1130], [2100, 1130]], 4),
    { type: 'prism', x: 220, y: 556, idx: 0 },
    { type: 'prism', x: 260, y: 1120, idx: 1 },
    { type: 'prism', x: 1450, y: 820, idx: 2 },
    { type: 'lantern', x: 1000, y: 1150, id: 'l1' },
    { type: 'exit', x: 2290, y: 1080, r: 46 },
    { type: 'hint', x: 600, y: 600, hx: 600, hy: 560, kind: 'drag', after: 6, r: 200 },
    { type: 'hint', x: 1560, y: 1100, hx: 1560, hy: 1020, kind: 'rally', after: 4, r: 260 },
  ],
});

// ── VI · Shear ────────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'shear', name: 'Shear', sub: 'VI · blades',
  bounds: [0, 300, 3400, 960], view: 1000, gravity: [0, 600], palette: PAL.amber, key: [45, 'dusk'], amb: 'tense',
  spawn: [250, 760], mass: 180, cap: 360, par: 85,
  geo: [
    carve(box(1700, 650, 3300, 500, 80)),                 // corridor (floor 900)
    add(box(900, 560, 440, 330, 30)),                     // tunnel roof (tunnel 725–900)
    add(box(2380, 560, 520, 260, 30)),                    // grinder roof (passage 690–900)
    add(box(1560, 905, 90, 40, 14), SURF.GLASS),          // small glass pedestal
  ],
  entities: [
    ...moteTrail([[200, 870], [560, 870]], 4),
    ...moteTrail([[720, 870], [1080, 870]], 5),
    ...moteTrail([[1200, 870], [1400, 870]], 3),
    ...moteTrail([[1700, 870], [1950, 870]], 3),
    ...moteTrail([[2160, 880], [2600, 880]], 5),
    ...moteTrail([[2750, 870], [3000, 870]], 3),
    { type: 'blade', x: 900, y: 812, len: 150, angle: Math.PI / 2, sweep: [150, 0], period: 2.8 },
    { type: 'blade', x: 1560, y: 700, len: 330, spin: 1.15 },
    { type: 'grinder', x: 2380, y: 700, r: 46, spin: 2.6, teeth: 12 },
    { type: 'pool', kind: 'heal', x: 2950, y: 885, w: 220, h: 40 },
    { type: 'pool', kind: 'catalyst', mat: MAT.BASTION, x: 420, y: 885, w: 150, h: 40 },
    { type: 'pool', kind: 'rinse', x: 3110, y: 885, w: 90, h: 40 },
    { type: 'prism', x: 1560, y: 530, idx: 0 },
    { type: 'prism', x: 900, y: 760, idx: 1 },
    { type: 'prism', x: 2380, y: 860, idx: 2 },
    { type: 'lantern', x: 600, y: 892, id: 'l1' },
    { type: 'lantern', x: 2000, y: 892, id: 'l2' },
    { type: 'exit', x: 3260, y: 820, r: 46 },
    { type: 'hint', x: 1700, y: 860, hx: 1700, hy: 760, kind: 'rally', after: 2, r: 400, until: { fn: (G) => G.colony && G.colony.orgs.length === 1 } },
  ],
});

// ── VII · Amber ───────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'amber', name: 'Amber', sub: 'VII · resin',
  bounds: [0, -620, 2640, 1000], view: 1050, gravity: [0, 600], palette: PAL.amber, key: [47, 'dorian'], amb: 'deep',
  spawn: [260, 760], mass: 170, cap: 340, par: 110,
  geo: [
    carve(box(500, 770, 800, 340, 60)),                                   // amber hall (floor 940)
    carve(box(560, 955, 280, 70, 24)),                                    // catalyst basin
    carve(box(1080, 200, 360, 1480, 50), 24, { mat: SURF.GLASS }),          // the glass flue
    carve(box(1800, 0, 1100, 1100, 70), 30, { mat: SURF.GLASS }),           // glass cavern (ceiling −550)
    carve(box(2470, -430, 300, 260, 40), 20),                             // landing ledge (floor −300)
    carve(box(1500, -585, 120, 60, 24), 0, { mat: SURF.GLASS }),            // ceiling alcove
    add(box(1800, 560, 240, 60, 20)),                                     // stone island in the cavern
  ],
  entities: [
    { type: 'pool', kind: 'catalyst', mat: MAT.RESIN, x: 560, y: 950, w: 260, h: 56 },
    ...moteTrail([[200, 910], [420, 910]], 3),
    ...moteTrail([[930, 860], [925, 600], [925, 300], [925, 0], [930, -300]], 10),
    ...moteTrail([[1240, -500], [1400, -525], [1700, -525], [2000, -525], [2250, -500]], 10),
    ...moteTrail([[1700, 520], [1900, 520]], 3),
    ...moteTrail([[2360, -330], [2440, -330]], 2),
    { type: 'pool', kind: 'rinse', x: 2470, y: -318, w: 160, h: 40 },
    { type: 'prism', x: 1500, y: -575, idx: 0 },
    { type: 'prism', x: 1800, y: 500, idx: 1 },
    { type: 'prism', x: 1240, y: 880, idx: 2 },
    { type: 'lantern', x: 1250, y: -470, id: 'l1' },
    { type: 'exit', x: 2560, y: -360, r: 44 },
    { type: 'hint', x: 960, y: 900, hx: 980, hy: 820, kind: 'climb', after: 4, r: 200 },
  ],
});

// ── VIII · Quicksilver ────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'quicksilver', name: 'Quicksilver', sub: 'VIII · speed',
  bounds: [0, 120, 4200, 1120], view: 1150, gravity: [0, 650], palette: PAL.steel, key: [52, 'lydian'], amb: 'bright',
  spawn: [180, 760], mass: 170, cap: 340, par: 45,
  geo: [
    carve(box(2100, 600, 4100, 920, 80)),                                 // the gallery
    add({ t: 'poly', pts: [[0, 1140], [0, 880], [220, 880], [480, 880], [700, 905], [960, 975], [1220, 1012], [1460, 995], [1700, 900], [1880, 760], [1990, 690], [2010, 690], [2010, 1140]], r: 0 }, SURF.GLASS),
    add({ t: 'poly', pts: [[2330, 1140], [2330, 700], [4200, 700], [4200, 1140]], r: 0 }, SURF.GLASS),
    carve(box(330, 890, 260, 50, 20)),                                    // silver basin
    add(box(2640, 390, 700, 300, 26), SURF.METAL),                        // crusher roof (corridor 540–700)
    add(box(3650, 420, 300, 40, 16), SURF.GLASS),                         // high glass shelf
  ],
  entities: [
    { type: 'pool', kind: 'catalyst', mat: MAT.SILVER, x: 330, y: 885, w: 240, h: 50, col: [0.8, 0.88, 1.0] },
    ...moteTrail([[560, 860], [800, 900], [1050, 960], [1300, 985], [1550, 950]], 9),
    ...moteTrail([[1800, 800], [1980, 650], [2150, 560], [2330, 620]], 6),
    ...moteTrail([[2450, 670], [2850, 670]], 6),
    ...moteTrail([[3000, 670], [3700, 670]], 10),
    { type: 'geyser', x: 2170, y: 1110, w: 220, h: 560, power: 1000 },
    { type: 'crusher', x: 2450, y: 470, w: 90, h: 140, travel: 150, period: 2.1, phase: 0.0 },
    { type: 'crusher', x: 2640, y: 470, w: 90, h: 140, travel: 150, period: 2.1, phase: 0.33 },
    { type: 'crusher', x: 2830, y: 470, w: 90, h: 140, travel: 150, period: 2.1, phase: 0.66 },
    { type: 'current', x: 3400, y: 640, w: 900, h: 120, vx: 650, vy: 0, k: 2.2 },
    { type: 'prism', x: 2170, y: 300, idx: 0 },
    { type: 'prism', x: 3650, y: 385, idx: 1 },
    { type: 'prism', x: 1220, y: 640, idx: 2 },
    { type: 'lantern', x: 2380, y: 692, id: 'l1' },
    { type: 'exit', x: 4030, y: 630, r: 46 },
  ],
});

// ── IX · Veil ─────────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'veil', name: 'Veil', sub: 'IX · hold your breath',
  bounds: [0, 260, 3200, 960], view: 1100, gravity: [0, 600], palette: { p0: [0.002, 0.003, 0.008], p1: [0.006, 0.01, 0.024], p2: [0.04, 0.05, 0.075], p3: [0.55, 0.65, 0.95], sky: [0.45, 0.55, 0.85], grid: 0.6 },
  key: [45, 'dorian'], amb: 'tense', veil: true,
  spawn: [200, 700], mass: 170, cap: 340, par: 75,
  geo: [
    carve(box(1600, 620, 3100, 520, 70)),                 // the watched gallery (floor 880)
    add(box(830, 848, 96, 74, 20)), add(box(1500, 842, 130, 86, 20)), add(box(2160, 848, 96, 74, 20)), add(box(2660, 846, 120, 78, 20)),
    add(box(1240, 420, 320, 150, 40)),                    // a hanging rock: shadow from above
    carve(box(1980, 380, 120, 70, 24)),                   // ceiling alcove (prism)
  ],
  entities: [
    { type: 'sentinel', x: 600, y: 410, a0: 0.55, a1: 2.1, period: 6, fov: 0.2, range: 640 },
    { type: 'sentinel', x: 1760, y: 400, a0: 0.45, a1: 2.45, period: 5.2, fov: 0.21, range: 660, phase: 0.35 },
    { type: 'sentinel', x: 2460, y: 410, a0: 0.5, a1: 2.3, period: 4.6, fov: 0.2, range: 640, phase: 0.7 },
    ...moteTrail([[160, 850], [420, 850]], 3),
    ...moteTrail([[560, 850], [760, 850]], 3),
    ...moteTrail([[930, 850], [1400, 850]], 5),
    ...moteTrail([[1620, 850], [2060, 850]], 4),
    ...moteTrail([[2260, 850], [2560, 850]], 3),
    ...moteTrail([[2780, 850], [2900, 850]], 2),
    { type: 'prism', x: 1760, y: 845, idx: 0 },
    { type: 'prism', x: 1500, y: 770, idx: 1 },
    { type: 'prism', x: 1980, y: 372, idx: 2 },
    { type: 'lantern', x: 1100, y: 872, id: 'l1' },
    { type: 'lantern', x: 2380, y: 872, id: 'l2' },
    { type: 'exit', x: 3040, y: 800, r: 46 },
    { type: 'hint', x: 420, y: 850, hx: 420, hy: 760, kind: 'still', after: 1.5, r: 260, until: { fn: (G) => G.colony && G.colony.focus && G.colony.focus.B.cx > 900 } },
  ],
});

// ── X · Tidepool ─────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'tidepool', name: 'Tidepool', sub: 'X · immiscible',
  bounds: [0, 0, 3000, 1300], view: 1150, gravity: [0, 600], palette: PAL.teal, key: [50, 'dorian'], amb: 'deep',
  spawn: [240, 300], mass: 170, cap: 340, par: 90,
  geo: [
    carve(box(1500, 700, 2900, 1180, 90)),                                // the flooded hall
    add(box(250, 520, 400, 280, 30)),                                     // dry start ledge (top 380)
    add(box(2780, 520, 360, 280, 30)),                                    // exit ledge (top 380)
    add(box(1500, 1180, 500, 160, 60)),                                   // reef mound
    carve(box(700, 1170, 220, 90, 40)),                                   // grotto I
    carve(box(2300, 1170, 220, 90, 40)),                                  // grotto II
  ],
  entities: [
    { type: 'zone', kind: 'water', x: 1500, y: 860, w: 2900, h: 860 },
    { type: 'current', x: 1500, y: 760, w: 1500, h: 140, vx: 240, vy: 0, k: 2.0 },
    { type: 'reservoir', x: 1100, y: 760, w: 600, h: 110, n: 300, mat: MAT.OIL, src: [800, 760], bounds: [700, 560, 2280, 960], vx: 200 },
    ...moteTrail([[300, 350], [430, 350]], 2),
    ...moteTrail([[560, 520], [700, 640], [760, 900], [900, 1050]], 6),
    ...moteTrail([[1100, 1050], [1300, 1060]], 3),
    ...moteTrail([[1700, 1060], [1950, 1040], [2200, 960], [2400, 800], [2560, 560]], 9),
    ...moteTrail([[2680, 350], [2800, 350]], 2),
    { type: 'geyser', x: 2560, y: 1190, w: 120, h: 860, power: 700 },
    { type: 'prism', x: 700, y: 1185, idx: 0 },
    { type: 'prism', x: 2300, y: 1185, idx: 1 },
    { type: 'prism', x: 1500, y: 600, idx: 2 },
    { type: 'lantern', x: 1500, y: 1092, id: 'l1' },
    { type: 'exit', x: 2860, y: 320, r: 44 },
  ],
});

// ── XI · Iron Bloom ────────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'iron-bloom', name: 'Iron Bloom', sub: 'XI · ferro',
  bounds: [0, 0, 3600, 1200], view: 1150, gravity: [0, 600], palette: PAL.abyss, key: [46, 'dusk'], amb: 'tense',
  spawn: [220, 700], mass: 170, cap: 340, par: 80,
  geo: [
    carve(box(1800, 560, 3500, 760, 80)),                                 // hall (floor 940)
    carve(box(1050, 1060, 700, 280, 40), 20, { mat: SURF.GLASS }),          // chasm I
    carve(box(2350, 1060, 700, 280, 40), 20, { mat: SURF.GLASS }),          // chasm II
    carve(box(420, 955, 260, 60, 22)),                                    // ferro basin
  ],
  entities: [
    { type: 'pool', kind: 'catalyst', mat: MAT.FERRO, x: 420, y: 950, w: 240, h: 54, col: [0.55, 0.65, 1.0] },
    { type: 'magnet', x: 1050, y: 420, power: 1.2, reach: 420 },
    { type: 'magnet', x: 2150, y: 380, power: 1.2, reach: 420, pulse: 3.2 },
    { type: 'magnet', x: 2560, y: 430, power: 1.2, reach: 420, pulse: 3.2, phase: 1.6 },
    { type: 'geyser', x: 1050, y: 1190, w: 300, h: 700, power: 950 },
    { type: 'geyser', x: 2350, y: 1190, w: 300, h: 700, power: 950 },
    ...moteTrail([[200, 910], [600, 910]], 4),
    ...moteTrail([[760, 860], [900, 640], [1050, 560], [1200, 640], [1340, 860]], 7),
    ...moteTrail([[1450, 910], [1900, 910]], 4),
    ...moteTrail([[2050, 860], [2150, 580], [2350, 560], [2560, 600], [2700, 860]], 8),
    ...moteTrail([[2800, 910], [3200, 910]], 4),
    { type: 'prism', x: 1050, y: 300, idx: 0 },
    { type: 'prism', x: 2350, y: 1170, idx: 1 },
    { type: 'prism', x: 3300, y: 300, idx: 2 },
    { type: 'magnet', x: 3300, y: 200, power: 0.9, reach: 260 },
    { type: 'lantern', x: 1600, y: 932, id: 'l1' },
    { type: 'exit', x: 3420, y: 860, r: 46 },
  ],
});

// ── XII · Event Horizon ────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'event-horizon', name: 'Event Horizon', sub: 'XII · singularity',
  bounds: [-1500, -1000, 1500, 1000], view: 1300, gravity: [0, 0], drag: 0.25, palette: PAL.abyss, key: [44, 'lydian'], amb: 'tense',
  spawn: [-1250, 0], mass: 180, cap: 360, par: 70,
  geo: [
    carve({ t: 'ellipse', x: 0, y: 0, rx: 1420, ry: 900 }),
    add({ t: 'circle', x: -300, y: -520, r: 90 }, SURF.STONE),
    add({ t: 'circle', x: 420, y: 560, r: 110 }, SURF.STONE),
  ],
  entities: [
    { type: 'singularity', x: -600, y: 140, r: 24, strength: 52000, reach: 560, swirl: 9000 },
    { type: 'singularity', x: 300, y: -180, r: 26, strength: 60000, reach: 600, swirl: -10000 },
    { type: 'singularity', x: 900, y: 320, r: 22, strength: 48000, reach: 500, swirl: 8000 },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ type: 'mote', x: -600 + Math.cos(k / 8 * Math.PI * 2) * 230, y: 140 + Math.sin(k / 8 * Math.PI * 2) * 230, value: 3 })),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ({ type: 'mote', x: 300 + Math.cos(k / 10 * Math.PI * 2) * 270, y: -180 + Math.sin(k / 10 * Math.PI * 2) * 270, value: 3 })),
    ...[0, 1, 2, 3, 4, 5].map(k => ({ type: 'mote', x: 900 + Math.cos(k / 6 * Math.PI * 2) * 210, y: 320 + Math.sin(k / 6 * Math.PI * 2) * 210, value: 3 })),
    { type: 'prism', x: -600, y: 60, idx: 0 },
    { type: 'prism', x: 300, y: -90, idx: 1 },
    { type: 'prism', x: 980, y: 320, idx: 2 },
    { type: 'lantern', x: -300, y: -400, id: 'l1' },
    { type: 'lantern', x: 420, y: 430, id: 'l2' },
    { type: 'exit', x: 1280, y: -100, r: 50, need: { lanterns: 2 } },
    { type: 'hint', x: -1250, y: 0, kind: 'flick', after: 6, r: 300 },
  ],
});

// ── XIII · The Heart ───────────────────────────────────────────────────────
CHAMBERS.push({
  id: 'the-heart', name: 'The Heart', sub: 'XIII · the hand of the world',
  bounds: [-920, -920, 920, 920], view: 1500, gravity: [0, 560], gravityRot: 0.16, palette: PAL.rose, key: [49, 'lydian'], amb: 'bright',
  spawn: [0, 560], mass: 200, cap: 380, par: 120, finale: true,
  geo: [
    carve({ t: 'circle', x: 0, y: 0, r: 860 }),
    add({ t: 'circle', x: 0, y: 0, r: 120 }, SURF.STONE),                  // the heart's shell
    add(box(0, -470, 260, 50, 22)), add(box(-420, 250, 260, 50, 22, { a: 2.1 })), add(box(420, 250, 260, 50, 22, { a: -2.1 })),
    add({ t: 'circle', x: -560, y: -520, r: 70 }, SURF.GLASS), add({ t: 'circle', x: 560, y: -520, r: 70 }, SURF.GLASS), add({ t: 'circle', x: 0, y: 760, r: 60 }, SURF.GLASS),
  ],
  entities: [
    { type: 'lantern', x: 0, y: -520, id: 'h1', col: [1.0, 0.6, 0.75] },
    { type: 'lantern', x: -470, y: 280, id: 'h2', col: [1.0, 0.75, 0.5] },
    { type: 'lantern', x: 470, y: 280, id: 'h3', col: [0.7, 0.8, 1.0] },
    { type: 'blade', x: 0, y: 0, len: 620, spin: 0.55 },
    ...[...Array(16)].map((_, k) => ({ type: 'mote', x: Math.cos(k / 16 * Math.PI * 2) * 680, y: Math.sin(k / 16 * Math.PI * 2) * 680, value: 3 })),
    ...[...Array(8)].map((_, k) => ({ type: 'mote', x: Math.cos(k / 8 * Math.PI * 2 + 0.2) * 300, y: Math.sin(k / 8 * Math.PI * 2 + 0.2) * 300, value: 3 })),
    { type: 'prism', x: -560, y: -520 - 100, idx: 0 },
    { type: 'prism', x: 560, y: -520 - 100, idx: 1 },
    { type: 'prism', x: 0, y: 760 - 90, idx: 2 },
    { type: 'exit', x: 0, y: 0, r: 190, need: ['h1', 'h2', 'h3'], heart: true },
  ],
});

export function chamberIndex(id) { return CHAMBERS.findIndex(c => c.id === id); }
