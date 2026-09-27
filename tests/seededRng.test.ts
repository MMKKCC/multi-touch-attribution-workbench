import { mulberry32, weightedChoice } from '../src/utils/seededRng.js';

describe('mulberry32', () => {
  test('returns values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('same seed produces same sequence', () => {
    const r1 = mulberry32(99);
    const r2 = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      expect(r1.next()).toBe(r2.next());
    }
  });

  test('different seeds produce different sequences', () => {
    const r1 = mulberry32(1);
    const r2 = mulberry32(2);
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (r1.next() !== r2.next()) { allSame = false; break; }
    }
    expect(allSame).toBe(false);
  });

  test('state advances (consecutive calls differ)', () => {
    const rng = mulberry32(7);
    const v1 = rng.next();
    const v2 = rng.next();
    expect(v1).not.toBe(v2);
  });

  test('state property reflects current seed as an object', () => {
    const rng = mulberry32(123);
    expect(rng.state.seed).toBe(123);
    rng.next();
    // State should have advanced
    expect(rng.state.seed).not.toBe(123);
  });

  test('produces uniform-ish distribution (rough check)', () => {
    const rng = mulberry32(0);
    const buckets = [0, 0, 0, 0, 0];
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const v = rng.next();
      buckets[Math.floor(v * 5)]++;
    }
    // Each bucket should have roughly N/5 = 1000 values, allow ±30%
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });
});

describe('weightedChoice', () => {
  // weightedChoice takes a rng function (() => number), not a value
  test('always returns a valid index', () => {
    const rng = mulberry32(1);
    const weights = [0.2, 0.5, 0.3];
    for (let i = 0; i < 100; i++) {
      const idx = weightedChoice(weights, rng.next);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(weights.length);
    }
  });

  test('respects weights: high-weight index should dominate', () => {
    const rng = mulberry32(42);
    const weights = [0.02, 0.96, 0.02]; // Index 1 should win ~96%
    const counts = [0, 0, 0];
    const N = 1000;
    for (let i = 0; i < N; i++) {
      counts[weightedChoice(weights, rng.next)]++;
    }
    // Index 1 should win the vast majority
    expect(counts[1]).toBeGreaterThan(900);
  });

  test('single-item array always returns index 0', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 20; i++) {
      expect(weightedChoice([1.0], rng.next)).toBe(0);
    }
  });

  test('exactly 0 weight items are never selected', () => {
    const rng = mulberry32(10);
    const weights = [0.0, 0.0, 1.0]; // Only index 2 can be chosen
    for (let i = 0; i < 50; i++) {
      expect(weightedChoice(weights, rng.next)).toBe(2);
    }
  });
});
