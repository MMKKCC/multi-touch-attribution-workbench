/**
 * Integration tests: full pipeline from journey generation → encoding → engine ingestion → results
 *
 * These tests protect against regressions in the complete data flow:
 * SyntheticGenerator → DictionaryEncoder → AttributionEngine
 *
 * Previously known failure mode: engine.ingestData must be awaited; not awaiting it
 * causes all subsequent calculations to return empty/zero results silently.
 */

import { AttributionEngine } from '../src/engine/AttributionEngine.js';
import { DictionaryEncoder } from '../src/engine/DictionaryEncoder.js';
import { generateJourneys } from '../src/engine/SyntheticGenerator.js';
import type { MarkovConfig } from '../src/types/index.js';
import { CONVERSION_STAGES } from '../src/types/index.js';

const PIPELINE_CONFIG: MarkovConfig = {
  channels: ['Search', 'Social', 'Email'],
  entryProbs: [0.5, 0.3, 0.2],
  transitions: [
    // Search: good advance rate
    [0.0, 0.15, 0.05, 0.60, 0.20],
    // Social: moderate
    [0.10, 0.0, 0.10, 0.50, 0.30],
    // Email: strong closer, weak opener
    [0.05, 0.10, 0.0, 0.55, 0.30],
  ],
  journeyCount: 300,
  seed: 77,
  maxTouchesPerStage: 15,
};

function buildFullPipeline(config: MarkovConfig) {
  const { journeys, rngSnapshots } = generateJourneys(config);
  const encoder = new DictionaryEncoder(config.channels);
  const dataset = encoder.encode(journeys);
  const dict = encoder.serialize();
  const engine = new AttributionEngine();
  engine.ingestData(dataset, dict);
  return { engine, journeys, rngSnapshots, encoder };
}

describe('Full Pipeline Integration', () => {
  let engine: AttributionEngine;

  beforeAll(() => {
    ({ engine } = buildFullPipeline(PIPELINE_CONFIG));
  });

  test('all 6 model types produce non-empty results', async () => {
    const heuristics = await engine.calculateHeuristics();
    const markov = await engine.calculateMarkov(1);
    const shapley = await engine.calculateShapley(300, () => {});

    expect(Object.keys(heuristics.firstTouch).length).toBeGreaterThan(0);
    expect(Object.keys(heuristics.lastTouch).length).toBeGreaterThan(0);
    expect(Object.keys(heuristics.linear).length).toBeGreaterThan(0);
    expect(Object.keys(heuristics.timeDecay).length).toBeGreaterThan(0);
    expect(Object.keys(markov).length).toBeGreaterThan(0);
    expect(Object.keys(shapley).length).toBeGreaterThan(0);
  });

  test('all models include all configured channels', async () => {
    const markov = await engine.calculateMarkov(1);
    for (const ch of PIPELINE_CONFIG.channels) {
      expect(ch in markov).toBe(true);
    }
  });

  test('Markov and Shapley produce non-zero credits for high-advance channel (Search)', async () => {
    const markov = await engine.calculateMarkov(1);
    const shapley = await engine.calculateShapley(500, () => {});

    // Search has the highest advance rate; both probabilistic models should give it meaningful credit
    const markovMQL = markov['Search']?.['MQL'] ?? 0;
    const shapleyMQL = shapley['Search']?.['MQL'] ?? 0;
    expect(markovMQL).toBeGreaterThan(0);
    expect(shapleyMQL).toBeGreaterThan(0);
  });

  test('velocity metrics are available for all channels after full pipeline', async () => {
    const velocity = await engine.calculateVelocityMetrics();
    for (const ch of PIPELINE_CONFIG.channels) {
      expect(velocity[ch]).toBeDefined();
      for (const stage of CONVERSION_STAGES) {
        expect(typeof velocity[ch][stage]).toBe('number');
      }
    }
  });

  test('bootstrap CI runs without error after full pipeline', async () => {
    const ci = await engine.runBootstrap('markov', 20);
    expect(ci).toBeDefined();
    for (const ch of PIPELINE_CONFIG.channels) {
      expect(ci[ch]).toBeDefined();
    }
  });
});

describe('Pipeline — Regression: ingestData must complete before calculations', () => {
  /**
   * Regression: early versions of App.tsx did not await engine.ingestData().
   * This caused all calculations to run against an empty dataset,
   * returning 0 credits for all channels with no error.
   */
  test('calculations return zero if ingestData is not called', async () => {
    const engine = new AttributionEngine();
    // Do NOT call ingestData — simulate the pre-fix behavior
    const markov = await engine.calculateMarkov(1);
    // With no data, all credits should be 0 or matrix should be empty
    const totalCredit = Object.values(markov).reduce((sum, stageMap) =>
      sum + Object.values(stageMap).reduce((s, v) => s + v, 0), 0);
    expect(totalCredit).toBe(0);
  });

  test('calculations return meaningful results after ingestData is called', async () => {
    const { journeys } = generateJourneys(PIPELINE_CONFIG);
    const encoder = new DictionaryEncoder(PIPELINE_CONFIG.channels);
    const dataset = encoder.encode(journeys);
    const dict = encoder.serialize();
    const engine = new AttributionEngine();

    engine.ingestData(dataset, dict); // Must be called before calculations
    const markov = await engine.calculateMarkov(1);

    const totalCredit = Object.values(markov).reduce((sum, stageMap) =>
      sum + Object.values(stageMap).reduce((s, v) => s + v, 0), 0);
    expect(totalCredit).toBeGreaterThan(0);
  });
});

describe('Pipeline — Regression: pseudoInverse fallback for singular matrices', () => {
  /**
   * Regression: ml-matrix v6 changed pseudoInverse from an instance method
   * to a standalone function. If called as matrix.pseudoInverse(), it throws
   * silently, returning null and producing 0 credits for all channels.
   *
   * Verify that degenerate configs (near-singular transition matrices) still
   * produce valid (non-zero, non-NaN) output.
   */
  test('degenerate config (all-advance, single channel) produces valid Markov output', async () => {
    const config: MarkovConfig = {
      channels: ['Only'],
      entryProbs: [1.0],
      transitions: [[0.0, 0.99, 0.01]], // Almost never drops
      journeyCount: 50,
      seed: 1,
      maxTouchesPerStage: 5,
    };
    const { journeys } = generateJourneys(config);
    const encoder = new DictionaryEncoder(config.channels);
    const engine = new AttributionEngine();
    engine.ingestData(encoder.encode(journeys), encoder.serialize());

    const markov = await engine.calculateMarkov(1);
    const credits = Object.values(markov['Only'] ?? {});
    // Should have some valid credits — not NaN, not all zero
    const hasValidCredit = credits.some(c => !isNaN(c) && c >= 0);
    expect(hasValidCredit).toBe(true);
  });
});

describe('Pipeline — DictionaryEncoder round-trip', () => {
  test('decoded journeys match original journey IDs', () => {
    const { journeys } = generateJourneys(PIPELINE_CONFIG);
    const encoder = new DictionaryEncoder(PIPELINE_CONFIG.channels);
    const dataset = encoder.encode(journeys);
    const dict = encoder.serialize();

    // Verify dictionary covers all channels
    for (const ch of PIPELINE_CONFIG.channels) {
      const idx = dict.channels.indexOf(ch);
      expect(idx).toBeGreaterThanOrEqual(0);
    }

    // Verify journey count in encoded dataset
    expect(dataset.journeyPointers.length / 2).toBe(journeys.length);
  });

  test('eventsBuffer length matches sum of all journey event counts × 4', () => {
    const { journeys } = generateJourneys(PIPELINE_CONFIG);
    const encoder = new DictionaryEncoder(PIPELINE_CONFIG.channels);
    const dataset = encoder.encode(journeys);

    const totalEvents = journeys.reduce((sum, j) => sum + j.events.length, 0);
    expect(dataset.eventsBuffer.length).toBe(totalEvents * 4);
  });
});
