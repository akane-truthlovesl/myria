// ─────────────────────────────────────────────────────────────────────────────
//  Rheology & optics table — every fluid in the universe is a row of numbers.
//  Nothing is hard-wired: bodies, morphs, temperature and zones modulate these
//  per particle every substep (see physics.js) and per pixel (see fluid.js).
// ─────────────────────────────────────────────────────────────────────────────

// Phases decide miscibility: same phase may cohere/fuse, different phases bead apart.
export const PHASE = { AQUA: 0, LIPID: 1, METAL: 2, FOAM: 3 };

export const MAT = {
  LUMEN: 0,     // signature crystal hydrogel — the soul of Myria
  SILVER: 1,    // hyper-slick quicksilver
  RESIN: 2,     // sticky amber climbing resin
  BASTION: 3,   // shear-thickening armour gel
  FERRO: 4,     // ferrofluid — answers magnets
  OIL: 5,       // immiscible lipid
  CRYO: 6,      // frozen shell
  FOAM: 7,      // effervescent propulsion foam
  DEW: 8,       // neutral dew (free light, food)
  RIVAL: 9,     // generic rival hydrogel (tinted per species)
  THORN: 10,    // bristled brawler gel
  EMBER: 11,    // hot catalytic gel
  SPORE: 12,    // decoy / probe gel
  GLASS: 13,    // near-rigid crystal (title glyphs, shells)
};

const defs = [];
function def(id, o) { defs[id] = o; }

const base = {
  phase: PHASE.AQUA,
  k: 0.08,         // cohesion/pressure stiffness
  kn: 0.32,        // near-pressure (anti-clumping, surface sharpness)
  rho0: 2.6,       // rest density
  sigma: 0.25,     // linear viscosity
  beta: 0.02,      // quadratic viscosity
  xsph: 0.2,       // velocity smoothing (silky coherence)
  spring: 1,       // viscoelastic springs on
  sk: 0.45,        // spring stiffness
  yieldR: 0.18,    // yield ratio
  plast: 1.0,      // plasticity rate
  creep: 0.9,      // viscoelastic memory fade (1/s)
  adh: 0.30,       // wall wetting (normal tack)
  fric: 0.03,      // tangential friction (≈0 → silk-slick)
  cling: 1,        // may actively grip surfaces
  rest: 0.0,       // restitution on walls
  grav: 1.0,       // gravity scale (density vs medium)
  drag: 0.0,       // extra ambient damping
  thick: 0.0,      // shear-thickening factor
  magnet: 0.0,     // response to magnetic fields
  // optics ── what survives Beer–Lambert per unit of dome thickness, what the gel emits
  absorb: [0.10, 0.55, 0.85],
  emit: [1.0, 0.55, 0.32],
  glow: 0.55,      // volumetric emission strength
  f0: 0.045,       // base reflectance (0.04 = water/gel, →1 = liquid metal)
  clarity: 1.0,    // 1 crystal clear … 0 milky (scatters the backdrop)
  bulge: 1.0,      // dome height multiplier
  halo: 0.5,       // how much light it leaks into the medium around it
};

def(MAT.LUMEN, { ...base, name: 'lumen',
  absorb: [0.05, 0.62, 1.05], emit: [1.0, 0.56, 0.36], glow: 0.62 });

def(MAT.SILVER, { ...base, name: 'silver',
  phase: PHASE.METAL, k: 0.07, kn: 0.36, sigma: 0.04, beta: 0.01, xsph: 0.05,
  spring: 0, adh: 0.02, fric: 0.0, cling: 0, grav: 1.25,
  absorb: [1.6, 1.5, 1.35], emit: [0.58, 0.68, 0.82], glow: 0.06, f0: 0.86, halo: 0.2 });

def(MAT.RESIN, { ...base, name: 'resin',
  k: 0.05, sigma: 1.6, beta: 0.05, xsph: 0.2, sk: 0.42, yieldR: 0.28, plast: 1.0,
  adh: 1.15, fric: 0.35, cling: 2,
  absorb: [0.03, 0.42, 1.55], emit: [1.0, 0.66, 0.16], glow: 0.5, f0: 0.07 });

def(MAT.BASTION, { ...base, name: 'bastion',
  k: 0.06, sigma: 0.45, xsph: 0.15, sk: 0.55, yieldR: 0.08, plast: 0.6, thick: 2.4,
  adh: 0.25, fric: 0.08,
  absorb: [0.75, 1.0, 0.16], emit: [0.66, 0.48, 1.0], glow: 0.55, clarity: 0.7, f0: 0.06 });

def(MAT.FERRO, { ...base, name: 'ferro',
  phase: PHASE.METAL, k: 0.06, sigma: 0.2, spring: 0, adh: 0.2, fric: 0.05, magnet: 1.0, grav: 1.15,
  absorb: [2.4, 2.4, 2.2], emit: [0.35, 0.45, 0.75], glow: 0.12, f0: 0.55, halo: 0.15 });

def(MAT.OIL, { ...base, name: 'oil',
  phase: PHASE.LIPID, k: 0.05, kn: 0.3, sigma: 0.06, beta: 0.02, xsph: 0.08, spring: 0,
  adh: 0.05, fric: 0.0, cling: 0, grav: 0.85,
  absorb: [0.16, 0.42, 1.25], emit: [1.0, 0.78, 0.25], glow: 0.10, f0: 0.16, halo: 0.12 });

def(MAT.CRYO, { ...base, name: 'cryo',
  k: 0.06, sigma: 2.6, xsph: 0.35, sk: 0.9, yieldR: 0.02, plast: 0.05, creep: 0.02, adh: 0.0, fric: 0.0, cling: 0, rest: 0.35,
  absorb: [0.7, 0.22, 0.06], emit: [0.6, 0.88, 1.0], glow: 0.4, clarity: 0.45, f0: 0.09 });

def(MAT.FOAM, { ...base, name: 'foam',
  phase: PHASE.FOAM, k: 0.04, kn: 0.22, rho0: 2.2, sigma: 0.9, spring: 1, sk: 0.72, adh: 0.12, grav: 0.35,
  absorb: [0.30, 0.10, 0.04], emit: [0.80, 0.96, 1.0], glow: 0.20, clarity: 0.72, f0: 0.075, halo: 0.3 });

def(MAT.DEW, { ...base, name: 'dew',
  sk: 0.25, absorb: [0.42, 0.2, 0.05], emit: [0.78, 0.96, 1.0], glow: 0.9 });

def(MAT.RIVAL, { ...base, name: 'rival',
  absorb: [0.95, 0.3, 0.08], emit: [0.3, 0.8, 1.0], glow: 0.5 });

def(MAT.THORN, { ...base, name: 'thorn',
  k: 0.06, sigma: 0.4, sk: 0.5, yieldR: 0.1,
  absorb: [0.12, 1.1, 0.8], emit: [1.0, 0.25, 0.42], glow: 0.55 });

def(MAT.EMBER, { ...base, name: 'ember',
  sigma: 0.12, absorb: [0.02, 0.6, 1.5], emit: [1.0, 0.42, 0.08], glow: 1.1, halo: 0.9 });

def(MAT.SPORE, { ...base, name: 'spore',
  absorb: [0.5, 0.12, 0.6], emit: [0.75, 1.0, 0.5], glow: 0.7 });

def(MAT.GLASS, { ...base, name: 'glass',
  k: 0.012, kn: 0.25, sigma: 1.5, xsph: 0.35, sk: 1.1, yieldR: 0.03, plast: 0.0, creep: 0.0, adh: 0.0, cling: 0,
  absorb: [0.3, 0.14, 0.05], emit: [0.6, 0.85, 1.0], glow: 0.5, clarity: 0.6 });

export const MATS = defs;
export const NMAT = defs.length;

// Packed typed arrays for the solver hot loop.
function pack(key) { const a = new Float32Array(NMAT); for (let i = 0; i < NMAT; i++) a[i] = defs[i][key]; return a; }
export const M = {
  phase: Uint8Array.from(defs.map(d => d.phase)),
  k: pack('k'), kn: pack('kn'), rho0: pack('rho0'), sigma: pack('sigma'), beta: pack('beta'),
  xsph: pack('xsph'), spring: pack('spring'), sk: pack('sk'), yieldR: pack('yieldR'), plast: pack('plast'), creep: pack('creep'),
  adh: pack('adh'), fric: pack('fric'), cling: pack('cling'), rest: pack('rest'), grav: pack('grav'),
  drag: pack('drag'), thick: pack('thick'), magnet: pack('magnet'),
};

// Wall surface materials (static SDF + dynamic shapes) — the "diegetic world grammar".
export const SURF = {
  STONE: 0,    // porous coral-glass: grippable, gentle tack
  GLASS: 1,    // cold mirror glass: ungrippable, perfect glide
  RESIN: 2,    // sticky amber: grabs and strings
  GRIT: 3,     // abrasive teeth: shears mass off into sparks
  BOUNCE: 4,   // hyper-elastic membrane: trampoline
  MEMBRANE: 5, // one-way semi-permeable skin
  METAL: 6,    // machine metal (crushers, irises)
  BLADE: 7,    // cutting edge
  ICE: 8,      // frozen: slick + chills
  WARM: 9,     // thermal plate: heats
};

export const SURF_PROPS = [
  /* STONE */    { fric: 0.05, adh: 1.0, cling: 1, rest: 0.0 },
  /* GLASS */    { fric: 0.0, adh: 0.25, cling: 0, rest: 0.0 },
  /* RESIN */    { fric: 0.6, adh: 3.0, cling: 1, rest: 0.0 },
  /* GRIT */     { fric: 0.25, adh: 0.4, cling: 1, rest: 0.1 },
  /* BOUNCE */   { fric: 0.02, adh: 0.0, cling: 0, rest: 1.25 },
  /* MEMBRANE */ { fric: 0.02, adh: 0.2, cling: 0, rest: 0.0 },
  /* METAL */    { fric: 0.05, adh: 0.8, cling: 1, rest: 0.0 },
  /* BLADE */    { fric: 0.0, adh: 0.0, cling: 0, rest: 0.0 },
  /* ICE */      { fric: 0.0, adh: 0.1, cling: 0, rest: 0.05 },
  /* WARM */     { fric: 0.05, adh: 0.8, cling: 1, rest: 0.0 },
];
export const SURF_FRIC = Float32Array.from(SURF_PROPS.map(s => s.fric));
export const SURF_ADH = Float32Array.from(SURF_PROPS.map(s => s.adh));
export const SURF_CLING = Uint8Array.from(SURF_PROPS.map(s => s.cling));
export const SURF_REST = Float32Array.from(SURF_PROPS.map(s => s.rest));
