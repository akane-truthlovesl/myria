// Scoped workaround used by the Pool and Duet modes (installed in enter(), removed in exit()).
// physics.components() fires onSplit before the child's count is aggregated, so
// Game._onSplit mistakes every torn-off piece for a crumb and turns it into
// neutral dew. Seed the count from the component size before delegating.
export function patchSplit(G) {
  if (G._kpSplitPatched) return;
  G._kpSplitPatched = true;
  G._onSplit = function (p, c) { if (!c.count && c._size) c.count = c._size; return Object.getPrototypeOf(G)._onSplit.call(G, p, c); };
}
export function unpatchSplit(G) { if (G._kpSplitPatched) { delete G._onSplit; delete G._kpSplitPatched; } }
