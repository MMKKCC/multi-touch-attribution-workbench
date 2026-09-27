/**
 * mulberry32 – fast, seedable 32-bit PRNG.
 * Returns a function that produces values in [0, 1).
 * The `state` object is mutated in-place so callers can snapshot it.
 */
export interface RngState {
  seed: number;
}

export function mulberry32(initialSeed: number): { next: () => number; state: RngState } {
  const state: RngState = { seed: initialSeed >>> 0 };

  function next(): number {
    state.seed = (state.seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return { next, state };
}

/** Pick a weighted random index from a probability array that sums to 1 */
export function weightedChoice(probs: number[], rng: () => number): number {
  const r = rng();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (r < cumulative) return i;
  }
  return probs.length - 1; // Clamp floating-point edge case
}
