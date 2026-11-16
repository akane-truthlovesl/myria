// Hues — the stars you gather are not a score to look at: they dye you. Each hue is a full optical recipe
// (what the gel absorbs, what it scatters back), so a new colour is a new jewel, not a repaint.
export const SKINS = [
  { id: 'coral', name: 'Coral', need: 0, tint: null },
  { id: 'honey', name: 'Honey', need: 8, tint: { id: 'sk-honey', absorb: [0.03, 0.40, 1.50], emit: [1.0, 0.70, 0.16], glow: 0.62, halo: 0.5 } },
  { id: 'rose', name: 'Rose', need: 18, tint: { id: 'sk-rose', absorb: [0.05, 0.90, 0.42], emit: [1.0, 0.40, 0.60], glow: 0.62, halo: 0.5 } },
  { id: 'jade', name: 'Jade', need: 30, tint: { id: 'sk-jade', absorb: [0.95, 0.06, 0.62], emit: [0.30, 0.95, 0.58], glow: 0.60, halo: 0.5, lit: [0.80, 1.0, 0.70] } },
  { id: 'pearl', name: 'Pearl', need: 44, tint: { id: 'sk-pearl', absorb: [0.14, 0.11, 0.09], emit: [0.96, 0.93, 0.90], glow: 0.52, halo: 0.55, lit: [1.0, 0.97, 0.90] } },
  { id: 'nebula', name: 'Nebula', need: 58, tint: { id: 'sk-nebula', absorb: [0.62, 0.36, 0.03], emit: [0.20, 0.40, 1.0], glow: 0.80, halo: 0.7, hot: [1.0, 0.40, 0.70], lit: [1.0, 0.52, 0.84] } },
];
export function skinFor(save) { const stars = save.stars(); const k = Math.max(0, Math.min(SKINS.length - 1, save.get('skin', 0) | 0)); return SKINS[k].need <= stars ? SKINS[k] : SKINS[0]; }
export function unlockedSkins(save) { const stars = save.stars(); return SKINS.filter(s => s.need <= stars); }
