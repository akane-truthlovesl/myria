// Living pigments — cosmetic tints unlocked by stars gathered in the Odyssey.
import { save } from './save.js';
export const TINTS = [
  { id: 'ember', name: 'Ember', stars: 0, tint: null, swatch: [1.0, 0.6, 0.45] },
  { id: 'dawnrose', name: 'Dawnrose', stars: 5, tint: { absorb: [0.04, 0.6, 0.32], emit: [1.0, 0.62, 0.78] }, swatch: [1.0, 0.55, 0.72] },
  { id: 'tide', name: 'Tide', stars: 10, tint: { absorb: [0.62, 0.12, 0.18], emit: [0.5, 0.95, 1.0] }, swatch: [0.45, 0.92, 1.0] },
  { id: 'aurora', name: 'Aurora', stars: 15, tint: { absorb: [0.55, 0.05, 0.42], emit: [0.62, 1.0, 0.7] }, swatch: [0.5, 1.0, 0.65] },
  { id: 'nebula', name: 'Nebula', stars: 20, tint: { absorb: [0.32, 0.62, 0.05], emit: [0.82, 0.62, 1.0] }, swatch: [0.75, 0.55, 1.0] },
  { id: 'solar', name: 'Solar', stars: 26, tint: { absorb: [0.02, 0.14, 0.85], emit: [1.0, 0.86, 0.42] }, swatch: [1.0, 0.85, 0.35] },
  { id: 'prismatic', name: 'Prismatic', stars: 32, tint: { absorb: [0.16, 0.16, 0.16], emit: [0.95, 0.95, 1.0], metal: 0.35 }, swatch: [0.92, 0.95, 1.0] },
];
export function currentTint() { const id = save.get('tint', 'ember'); const t = TINTS.find(x => x.id === id) || TINTS[0]; return t.tint; }
export function unlocked(t) { return save.starsTotal() >= t.stars || save.get('allTints', false); }
