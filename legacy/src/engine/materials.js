// ─────────────────────────────────────────────────────────────────────────────
//  Rheology table — every fluid in the universe is a row of numbers.
//  Nothing is hard-wired: bodies, skills, temperature and zones modulate these
//  per particle every substep (see physics.js).
// ─────────────────────────────────────────────────────────────────────────────

// Phases decide miscibility: same phase may cohere/fuse, different phases repel.
export const PHASE = { AQUA: 0, LIPID: 1, METAL: 2, FOAM: 3 };

export const MAT = {
  LUMEN: 0,     // signature crystal hydrogel — the soul of Myria
  SILVER: 1,    // hyper-slick quicksilver
  RESIN: 2,     // sticky amber climbing resin
  BASTION: 3,   // shear-thickening armor gel
  FERRO: 4,     // ferrofluid — answers magnets
  OIL: 5,       // immiscible lipid
  CRYO: 6,      // frozen shell
  FOAM: 7,      // effervescent propulsion foam
  DEW: 8,       // neutral dew (food)
  RIVAL: 9,     // rival hydrogel (AI)
  THORN: 10,    // bristled brawler gel
  EMBER: 11,    // hot catalytic gel (heals / burns)
  SPORE: 12,    // decoy / probe gel
  GLYPH: 13,    // frozen crystal letterforms (title)
};

const defs = [];
function def(id, o) { defs[id] = o; }

const base = {
  phase: PHASE.AQUA,
  k: 0.08,         // cohesion/pressure stiffness (fraction of H per substep²-scaled)
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
  cling: 1,        // may actively climb
  rest: 0.0,       // restitution on walls
  grav: 1.0,       // gravity scale (density vs medium)
  drag: 0.0,       // ambient damping
  thick: 0.0,      // shear-thickening factor
  magnet: 0.0,     // response to magnetic fields
  // optics — absorption tint (what survives Beer–Lambert), emission, gloss
  absorb: [0.10, 0.55, 0.85],
  emit: [1.0, 0.55, 0.32],
  metal: 0.0,
  glowK: 1.0,      // emission strength
  frost: 0.0,
  ior: 1.0,
};

def(MAT.LUMEN, { ...base, name: 'lumen',
  absorb: [0.03, 0.40, 0.56], emit: [1.0, 0.62, 0.50] });

def(MAT.SILVER, { ...base, name: 'silver',
  phase: PHASE.METAL, k: 0.07, kn: 0.36, sigma: 0.04, beta: 0.01, xsph: 0.05,
  spring: 0, adh: 0.02, fric: 0.0, cling: 0, grav: 1.25,
  absorb: [0.55, 0.55, 0.58], emit: [0.75, 0.85, 1.0], metal: 0.92, ior: 1.2 });

def(MAT.RESIN, { ...base, name: 'resin',
  k: 0.05, sigma: 1.6, beta: 0.05, xsph: 0.2, sk: 0.42, yieldR: 0.28, plast: 1.0,
  adh: 1.15, fric: 0.35, cling: 2,
  absorb: [0.02, 0.28, 0.9], emit: [1.0, 0.68, 0.18], ior: 1.1 });

def(MAT.BASTION, { ...base, name: 'bastion',
  k: 0.06, sigma: 0.45, xsph: 0.15, sk: 0.55, yieldR: 0.08, plast: 0.6, thick: 2.4,
  adh: 0.25, fric: 0.08,
  absorb: [0.55, 0.85, 0.12], emit: [0.68, 0.45, 1.0], frost: 0.15 });

def(MAT.FERRO, { ...base, name: 'ferro',
  phase: PHASE.METAL, k: 0.06, sigma: 0.2, spring: 0, adh: 0.2, fric: 0.05, magnet: 1.0, grav: 1.15,
  absorb: [0.92, 0.92, 0.9], emit: [0.35, 0.45, 0.7], metal: 0.75 });

def(MAT.OIL, { ...base, name: 'oil',
  phase: PHASE.LIPID, k: 0.05, kn: 0.3, sigma: 0.06, beta: 0.02, xsph: 0.08, spring: 0,
  adh: 0.05, fric: 0.0, cling: 0, grav: 0.85,
  absorb: [0.10, 0.30, 0.85], emit: [1.0, 0.75, 0.3], metal: 0.35, glowK: 0.12, ior: 1.15 });

def(MAT.CRYO, { ...base, name: 'cryo',
  k: 0.06, sigma: 2.6, xsph: 0.35, sk: 0.9, yieldR: 0.02, plast: 0.05, creep: 0.02, adh: 0.0, fric: 0.0, cling: 0, rest: 0.35,
  absorb: [0.55, 0.18, 0.05], emit: [0.55, 0.85, 1.0], frost: 0.85 });

def(MAT.FOAM, { ...base, name: 'foam',
  phase: PHASE.FOAM, k: 0.04, kn: 0.22, rho0: 2.2, sigma: 0.3, spring: 1, sk: 0.2, adh: 0.12, grav: 0.35,
  absorb: [0.12, 0.08, 0.04], emit: [0.95, 0.98, 1.0], frost: 0.45 });

def(MAT.DEW, { ...base, name: 'dew',
  sk: 0.25, absorb: [0.35, 0.18, 0.06], emit: [0.75, 0.95, 1.0] });

def(MAT.RIVAL, { ...base, name: 'rival',
  absorb: [0.75, 0.22, 0.05], emit: [0.35, 0.8, 1.0] });

def(MAT.THORN, { ...base, name: 'thorn',
  k: 0.06, sigma: 0.4, sk: 0.5, yieldR: 0.1,
  absorb: [0.1, 0.85, 0.65], emit: [1.0, 0.3, 0.45] });

def(MAT.EMBER, { ...base, name: 'ember',
  sigma: 0.12, absorb: [0.02, 0.5, 0.95], emit: [1.0, 0.45, 0.1] });

def(MAT.SPORE, { ...base, name: 'spore',
  absorb: [0.4, 0.1, 0.5], emit: [0.75, 1.0, 0.55] });

def(MAT.GLYPH, { ...base, name: 'glyph',
  k: 0.012, kn: 0.25, sigma: 1.5, xsph: 0.35, sk: 1.1, yieldR: 0.03, plast: 0.0, creep: 0.0, adh: 0.0, cling: 0,
  absorb: [0.22, 0.10, 0.03], emit: [0.55, 0.82, 1.0], glowK: 0.85, frost: 0.4 });

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

// Wall surface materials (static SDF + dynamic shapes) — "diegetic world grammar".
export const SURF = {
  STONE: 0,    // porous coral-stone: clingable, gentle tack
  GLASS: 1,    // slick cold glass: unclingable, mirror-glide
  RESIN: 2,    // sticky amber bars: grabs and strings
  GRIT: 3,     // abrasive teeth: shears mass off into sparks
  BOUNCE: 4,   // hyper-elastic membrane: trampoline
  MEMBRANE: 5, // one-way semi-permeable skin
  METAL: 6,    // machine metal (crushers, irises) — clingable, cool
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
