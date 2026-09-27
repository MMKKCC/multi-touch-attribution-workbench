import { AttributionEngine } from '../src/engine/AttributionEngine.js';
import { DictionaryEncoder } from '../src/engine/DictionaryEncoder.js';
import { generateJourneys } from '../src/engine/SyntheticGenerator.js';
import type { MarkovConfig, HeuristicModelName } from '../src/types/index.js';
import { CONVERSION_STAGES } from '../src/types/index.js';

// Config where channel A strongly drives conversions, C is weak
const TEST_CONFIG: MarkovConfig = {
  channels: ['A', 'B', 'C'],
  entryProbs: [0.4, 0.35, 0.25],
  transitions: [
    // A: high advance rate
    [0.0, 0.15, 0.05, 0.65, 0.15],
    // B: moderate advance rate
    [0.10, 0.0, 0.05, 0.50, 0.35],
    // C: low advance rate
    [0.10, 0.10, 0.0, 0.30, 0.50],
  ],
  journeyCount: 800,
  seed: 42,
  maxTouchesPerStage: 20,
};

function buildEngine(config: MarkovConfig): AttributionEngine {
  const { journeys } = generateJourneys(config);
  const encoder = new DictionaryEncoder(config.channels);
  const dataset = encoder.encode(journeys);
  const dict = encoder.serialize();
  const engine = new AttributionEngine();
  engine.ingestData(dataset, dict);
  return engine;
}

describe('AttributionEngine — Heuristics', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    engine = buildEngine(TEST_CONFIG);
  });

  const heuristicModels: HeuristicModelName[] = ['firstTouch', 'lastTouch', 'linear', 'timeDecay'];

  test.each(heuristicModels)('%s: all channels present in output', async (model) => {
    const result = await engine.calculateHeuristics();
    const matrix = result[model];
    for (const ch of TEST_CONFIG.channels) {
      expect(ch in matrix).toBe(true);
    }
  });

  test.each(heuristicModels)('%s: credits sum to ~1 per stage', async (model) => {
    const result = await engine.calculateHeuristics();
    const matrix = result[model];
    for (const stage of CONVERSION_STAGES) {
      const sum = TEST_CONFIG.channels.reduce((acc, ch) => acc + (matrix[ch]?.[stage] ?? 0), 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  test.each(heuristicModels)('%s: all credits are non-negative', async (model) => {
    const result = await engine.calculateHeuristics();
    const matrix = result[model];
    for (const ch of TEST_CONFIG.channels) {
      for (const stage of CONVERSION_STAGES) {
        expect(matrix[ch]?.[stage] ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('firstTouch credits are non-zero for entry channels', async () => {
    const result = await engine.calculateHeuristics();
    const matrix = result.firstTouch;
    // Channel A has highest entry probability (0.4), should have highest first-touch
    const aCredit = matrix['A']?.['MQL'] ?? 0;
    const cCredit = matrix['C']?.['MQL'] ?? 0;
    expect(aCredit).toBeGreaterThan(cCredit);
  });

  test('linear: no single channel dominates (~equal distribution)', async () => {
    const result = await engine.calculateHeuristics();
    const matrix = result.linear;
    for (const stage of CONVERSION_STAGES) {
      const credits = TEST_CONFIG.channels.map(ch => matrix[ch]?.[stage] ?? 0);
      const max = Math.max(...credits);
      // No channel should take more than 80% in linear model with 3 channels
      if (credits.some(c => c > 0)) {
        expect(max).toBeLessThan(0.85);
      }
    }
  });
});

describe('AttributionEngine — Markov', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    engine = buildEngine(TEST_CONFIG);
  });

  test('returns matrix with all channels', async () => {
    const matrix = await engine.calculateMarkov(1);
    for (const ch of TEST_CONFIG.channels) {
      expect(ch in matrix).toBe(true);
    }
  });

  test('credits sum to ~1 per stage', async () => {
    const matrix = await engine.calculateMarkov(1);
    for (const stage of CONVERSION_STAGES) {
      const sum = TEST_CONFIG.channels.reduce((acc, ch) => acc + (matrix[ch]?.[stage] ?? 0), 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  test('all credits are in [0, 1]', async () => {
    const matrix = await engine.calculateMarkov(1);
    for (const ch of TEST_CONFIG.channels) {
      for (const stage of CONVERSION_STAGES) {
        const credit = matrix[ch]?.[stage] ?? 0;
        expect(credit).toBeGreaterThanOrEqual(0);
        expect(credit).toBeLessThanOrEqual(1);
      }
    }
  });

  test('channel A (highest advance rate) gets more credit than C (lowest)', async () => {
    const matrix = await engine.calculateMarkov(1);
    // A should consistently outperform C in Markov
    let aWins = 0;
    let cWins = 0;
    for (const stage of CONVERSION_STAGES) {
      const a = matrix['A']?.[stage] ?? 0;
      const c = matrix['C']?.[stage] ?? 0;
      if (a > 0 || c > 0) {
        if (a > c) aWins++;
        else if (c > a) cWins++;
      }
    }
    expect(aWins).toBeGreaterThan(cWins);
  });

  test('order 2 runs without error', async () => {
    const matrix = await engine.calculateMarkov(2);
    expect(matrix).toBeDefined();
    for (const ch of TEST_CONFIG.channels) {
      expect(ch in matrix).toBe(true);
    }
  });

  test('order 3 runs without error', async () => {
    const matrix = await engine.calculateMarkov(3);
    expect(matrix).toBeDefined();
  });
});

describe('AttributionEngine — Shapley', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    engine = buildEngine(TEST_CONFIG);
  });

  test('returns all channels with non-negative credits', async () => {
    const matrix = await engine.calculateShapley(500, () => {});
    for (const ch of TEST_CONFIG.channels) {
      for (const stage of CONVERSION_STAGES) {
        expect(matrix[ch]?.[stage] ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('credits sum to ~1 per stage', async () => {
    const matrix = await engine.calculateShapley(500, () => {});
    for (const stage of CONVERSION_STAGES) {
      const sum = TEST_CONFIG.channels.reduce((acc, ch) => acc + (matrix[ch]?.[stage] ?? 0), 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  test('onProgress callback is called', async () => {
    const calls: number[] = [];
    await engine.calculateShapley(300, (pct) => calls.push(pct));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBeGreaterThan(0);
  });
});

describe('AttributionEngine — Bootstrap', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    engine = buildEngine(TEST_CONFIG);
  });

  test('returns CI with lower <= mean <= upper per channel/stage', async () => {
    const ci = await engine.runBootstrap('markov', 30);
    for (const ch of TEST_CONFIG.channels) {
      for (const stage of CONVERSION_STAGES) {
        const entry = ci[ch]?.[stage];
        if (entry) {
          expect(entry.lower).toBeLessThanOrEqual(entry.mean + 0.001);
          expect(entry.mean).toBeLessThanOrEqual(entry.upper + 0.001);
          expect(entry.lower).toBeGreaterThanOrEqual(0);
          expect(entry.upper).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('AttributionEngine — Velocity', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    engine = buildEngine(TEST_CONFIG);
  });

  test('all channels have velocity entries for conversion stages', async () => {
    const velocity = await engine.calculateVelocityMetrics();
    for (const ch of TEST_CONFIG.channels) {
      expect(ch in velocity).toBe(true);
      for (const stage of CONVERSION_STAGES) {
        expect(typeof velocity[ch][stage]).toBe('number');
      }
    }
  });

  test('velocity values are non-negative', async () => {
    const velocity = await engine.calculateVelocityMetrics();
    for (const ch of TEST_CONFIG.channels) {
      for (const stage of CONVERSION_STAGES) {
        expect(velocity[ch][stage]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('AttributionEngine — edge cases', () => {
  test('handles dataset with all-won journeys', async () => {
    const config: MarkovConfig = {
      channels: ['X', 'Y'],
      entryProbs: [0.5, 0.5],
      transitions: [
        [0.1, 0.1, 0.8, 0.0], // X: always advance
        [0.1, 0.1, 0.8, 0.0], // Y: always advance
      ],
      journeyCount: 50,
      seed: 1,
      maxTouchesPerStage: 10,
    };
    const engine = buildEngine(config);
    const matrix = await engine.calculateMarkov(1);
    for (const ch of config.channels) {
      for (const stage of CONVERSION_STAGES) {
        expect(matrix[ch]?.[stage] ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('handles single-channel dataset', async () => {
    const config: MarkovConfig = {
      channels: ['Solo'],
      entryProbs: [1.0],
      transitions: [[0.0, 0.7, 0.3]],
      journeyCount: 100,
      seed: 7,
      maxTouchesPerStage: 10,
    };
    const engine = buildEngine(config);
    const matrix = await engine.calculateMarkov(1);
    expect(matrix['Solo']).toBeDefined();
  });
});
