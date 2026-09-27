import { DictionaryEncoder, decodeJourney } from '../src/engine/DictionaryEncoder.js';
import type { RawJourney } from '../src/types/index.js';

const CHANNELS = ['Paid Search', 'Organic', 'Webinar'];

const SAMPLE_JOURNEYS: RawJourney[] = [
  {
    journeyId: 'J000000',
    terminalState: 'Won',
    events: [
      { journeyId: 'J000000', timestamp: 1700000000, channel: 'Paid Search', stage: 'Touch' },
      { journeyId: 'J000000', timestamp: 1700003600, channel: 'Organic', stage: 'Touch' },
      { journeyId: 'J000000', timestamp: 1700007200, channel: 'Organic', stage: 'MQL' },
      { journeyId: 'J000000', timestamp: 1700010800, channel: 'Webinar', stage: 'SQL' },
      { journeyId: 'J000000', timestamp: 1700014400, channel: 'Webinar', stage: 'Won' },
    ],
  },
  {
    journeyId: 'J000001',
    terminalState: 'Lost',
    events: [
      { journeyId: 'J000001', timestamp: 1700000000, channel: 'Webinar', stage: 'Touch' },
      { journeyId: 'J000001', timestamp: 1700003600, channel: 'Webinar', stage: 'Lost' },
    ],
  },
];

describe('DictionaryEncoder', () => {
  let encoder: DictionaryEncoder;

  beforeEach(() => {
    encoder = new DictionaryEncoder(CHANNELS);
  });

  test('encodes channels to sequential integers starting at 0', () => {
    const dict = encoder.dictionary;
    expect(dict.channelToInt.get('Paid Search')).toBe(0);
    expect(dict.channelToInt.get('Organic')).toBe(1);
    expect(dict.channelToInt.get('Webinar')).toBe(2);
  });

  test('provides bidirectional channel mapping', () => {
    const dict = encoder.dictionary;
    for (let i = 0; i < CHANNELS.length; i++) {
      expect(dict.intToChannel.get(i)).toBe(CHANNELS[i]);
    }
  });

  test('encodes funnel stages in canonical order', () => {
    const dict = encoder.dictionary;
    expect(dict.stageToInt.get('Touch')).toBe(0);
    expect(dict.stageToInt.get('MQL')).toBe(1);
    expect(dict.stageToInt.get('SQL')).toBe(2);
    expect(dict.stageToInt.get('Opp')).toBe(3);
    expect(dict.stageToInt.get('Won')).toBe(4);
    expect(dict.stageToInt.get('Lost')).toBe(5);
  });

  test('encode() produces correct buffer sizes', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    const totalEvents = SAMPLE_JOURNEYS.reduce((sum, j) => sum + j.events.length, 0);
    expect(dataset.numJourneys).toBe(2);
    expect(dataset.numEvents).toBe(totalEvents);
    expect(dataset.eventsBuffer.length).toBe(totalEvents * 4);
    expect(dataset.journeyPointers.length).toBe(2 * 2);
  });

  test('first journey pointer starts at 0', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    expect(dataset.journeyPointers[0]).toBe(0); // startIndex
    expect(dataset.journeyPointers[1]).toBe(5); // length of first journey
  });

  test('second journey pointer starts after first journey', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    const firstLength = SAMPLE_JOURNEYS[0].events.length;
    expect(dataset.journeyPointers[2]).toBe(firstLength * 4); // startIndex = 5 events × 4 fields
    expect(dataset.journeyPointers[3]).toBe(2);
  });

  test('timestamps fit in Uint32 (seconds, not ms)', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    // All timestamps should be < 4294967295 (max Uint32)
    for (let i = 0; i < dataset.eventsBuffer.length; i += 4) {
      const ts = dataset.eventsBuffer[i + 1];
      expect(ts).toBeLessThan(4294967295);
      expect(ts).toBeGreaterThan(0);
    }
  });

  test('channel integers match dictionary', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    const dict = encoder.dictionary;
    // First event: Paid Search = 0
    expect(dataset.eventsBuffer[2]).toBe(dict.channelToInt.get('Paid Search'));
  });

  test('serialize() produces arrays with correct lengths', () => {
    const s = encoder.serialize();
    expect(s.channels.length).toBe(CHANNELS.length);
    expect(s.stages.length).toBe(6);
    expect(s.channels).toEqual(CHANNELS);
  });

  test('decodeJourney() round-trips correctly', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    const serialized = encoder.serialize();
    const decoded = decodeJourney(dataset, serialized, 0);

    expect(decoded.length).toBe(SAMPLE_JOURNEYS[0].events.length);
    expect(decoded[0].channel).toBe('Paid Search');
    expect(decoded[0].stage).toBe('Touch');
    expect(decoded[0].timestamp).toBe(1700000000);
    expect(decoded[1].channel).toBe('Organic');
  });

  test('decodeJourney() correctly decodes second journey', () => {
    const dataset = encoder.encode(SAMPLE_JOURNEYS);
    const serialized = encoder.serialize();
    const decoded = decodeJourney(dataset, serialized, 1);

    expect(decoded.length).toBe(2);
    expect(decoded[0].channel).toBe('Webinar');
    expect(decoded[1].stage).toBe('Lost');
  });
});
