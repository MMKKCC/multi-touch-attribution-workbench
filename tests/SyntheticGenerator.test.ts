import { generateJourneys } from '../src/engine/SyntheticGenerator.js';
import type { MarkovConfig } from '../src/types/index.js';

// Minimal 3-channel config for testing
const SIMPLE_CONFIG: MarkovConfig = {
  channels: ['A', 'B', 'C'],
  entryProbs: [0.5, 0.3, 0.2],
  transitions: [
    // A: 20% to B, 10% to C, 50% advance, 20% drop
    [0.0, 0.2, 0.1, 0.5, 0.2],
    // B: 10% to A, 0% to C, 60% advance, 30% drop
    [0.1, 0.0, 0.0, 0.6, 0.3],
    // C: 10% to A, 10% to B, 70% advance, 10% drop
    [0.1, 0.1, 0.0, 0.7, 0.1],
  ],
  journeyCount: 200,
  seed: 123,
  maxTouchesPerStage: 20,
};

describe('SyntheticGenerator', () => {
  test('generates the correct number of journeys', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    expect(journeys.length).toBe(200);
  });

  test('all journeys have unique IDs', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    const ids = journeys.map(j => j.journeyId);
    const unique = new Set(ids);
    expect(unique.size).toBe(journeys.length);
  });

  test('all events have valid channels', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    const valid = new Set(SIMPLE_CONFIG.channels);
    for (const journey of journeys) {
      for (const event of journey.events) {
        expect(valid.has(event.channel) || ['Won', 'Lost'].includes(event.stage)).toBe(true);
      }
    }
  });

  test('all events have valid stages', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    const valid = new Set(['Touch', 'MQL', 'SQL', 'Opp', 'Won', 'Lost']);
    for (const journey of journeys) {
      for (const event of journey.events) {
        expect(valid.has(event.stage)).toBe(true);
      }
    }
  });

  test('terminal states are Won, Lost, or Null', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    const valid = new Set(['Won', 'Lost', 'Null']);
    for (const j of journeys) {
      expect(valid.has(j.terminalState)).toBe(true);
    }
  });

  test('events are sorted by timestamp (non-decreasing)', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    for (const journey of journeys) {
      for (let i = 1; i < journey.events.length; i++) {
        expect(journey.events[i].timestamp).toBeGreaterThanOrEqual(
          journey.events[i - 1].timestamp
        );
      }
    }
  });

  test('all timestamps fit in Uint32 (seconds < 4294967295)', () => {
    const { journeys } = generateJourneys(SIMPLE_CONFIG);
    for (const journey of journeys) {
      for (const event of journey.events) {
        expect(event.timestamp).toBeLessThan(4294967295);
        expect(event.timestamp).toBeGreaterThan(0);
      }
    }
  });

  test('produces identical results for the same seed', () => {
    const { journeys: r1 } = generateJourneys(SIMPLE_CONFIG);
    const { journeys: r2 } = generateJourneys(SIMPLE_CONFIG);
    expect(r1.length).toBe(r2.length);
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i].journeyId).toBe(r2[i].journeyId);
      expect(r1[i].terminalState).toBe(r2[i].terminalState);
      expect(r1[i].events.length).toBe(r2[i].events.length);
    }
  });

  test('produces different results for different seeds', () => {
    const { journeys: r1 } = generateJourneys({ ...SIMPLE_CONFIG, seed: 1 });
    const { journeys: r2 } = generateJourneys({ ...SIMPLE_CONFIG, seed: 999 });
    const terminalsDiffer = r1.some((j, i) => j.terminalState !== r2[i].terminalState);
    expect(terminalsDiffer).toBe(true);
  });

  test('some journeys should win and some lose with moderate advance probability', () => {
    const { journeys } = generateJourneys({ ...SIMPLE_CONFIG, journeyCount: 500 });
    const won = journeys.filter(j => j.terminalState === 'Won').length;
    const lost = journeys.filter(j => j.terminalState === 'Lost').length;
    expect(won).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  });

  test('rngSnapshots has one entry per journey', () => {
    const { rngSnapshots, journeys } = generateJourneys(SIMPLE_CONFIG);
    expect(rngSnapshots.length).toBe(journeys.length);
  });

  test('rngSnapshot journeyIndex matches array position', () => {
    const { rngSnapshots } = generateJourneys(SIMPLE_CONFIG);
    for (let i = 0; i < rngSnapshots.length; i++) {
      expect(rngSnapshots[i].journeyIndex).toBe(i);
    }
  });
});
