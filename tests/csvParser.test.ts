import { parseCSVText } from '../src/utils/csvParser.js';

describe('csvParser — parseCSVText', () => {
  const VALID_CSV = `Journey_ID,Timestamp,Channel,Stage
j1,1700000000,Paid Search,Touch
j1,1700003600,LinkedIn,MQL
j1,1700007200,Email,Won
j2,1700000100,Organic,Touch
j2,1700004000,Organic,Lost`;

  test('parses valid CSV into journeys', () => {
    const journeys = parseCSVText(VALID_CSV);
    expect(journeys.length).toBe(2);
  });

  test('groups events by journeyId', () => {
    const journeys = parseCSVText(VALID_CSV);
    const j1 = journeys.find(j => j.journeyId === 'j1');
    expect(j1).toBeDefined();
    expect(j1!.events.length).toBe(3);
  });

  test('events are sorted by timestamp within each journey', () => {
    const journeys = parseCSVText(VALID_CSV);
    for (const j of journeys) {
      for (let i = 1; i < j.events.length; i++) {
        expect(j.events[i].timestamp).toBeGreaterThanOrEqual(j.events[i - 1].timestamp);
      }
    }
  });

  test('terminal state is Won for journey that ends in Won', () => {
    const journeys = parseCSVText(VALID_CSV);
    const j1 = journeys.find(j => j.journeyId === 'j1');
    expect(j1!.terminalState).toBe('Won');
  });

  test('terminal state is Lost for journey that ends in Lost', () => {
    const journeys = parseCSVText(VALID_CSV);
    const j2 = journeys.find(j => j.journeyId === 'j2');
    expect(j2!.terminalState).toBe('Lost');
  });

  test('terminal state is Null when no terminal event', () => {
    const csv = `Journey_ID,Timestamp,Channel,Stage
jx,1700000000,Organic,Touch
jx,1700003600,Email,MQL`;
    const journeys = parseCSVText(csv);
    expect(journeys[0].terminalState).toBe('Null');
  });

  test('handles case-insensitive column headers', () => {
    const csv = `journey_id,timestamp,channel,stage
abc,1700000000,Email,Touch`;
    const journeys = parseCSVText(csv);
    expect(journeys.length).toBe(1);
    expect(journeys[0].journeyId).toBe('abc');
  });

  test('auto-converts millisecond timestamps to seconds', () => {
    const tsMs = 1700000000000; // ms
    const csv = `Journey_ID,Timestamp,Channel,Stage
j1,${tsMs},Email,Touch`;
    const journeys = parseCSVText(csv);
    // Should be stored as seconds (~1700000000)
    expect(journeys[0].events[0].timestamp).toBeCloseTo(1700000000, -2);
  });

  test('handles ISO-8601 timestamp strings', () => {
    const csv = `Journey_ID,Timestamp,Channel,Stage
j1,2023-11-14T22:13:20Z,Email,Touch`;
    const journeys = parseCSVText(csv);
    expect(journeys.length).toBe(1);
    expect(journeys[0].events[0].timestamp).toBeGreaterThan(0);
  });

  test('throws on missing required columns', () => {
    const bad = `Journey_ID,Channel,Stage
j1,Email,Touch`;
    expect(() => parseCSVText(bad)).toThrow();
  });

  test('throws for CSV with only a header row', () => {
    const csv = 'Journey_ID,Timestamp,Channel,Stage\n';
    expect(() => parseCSVText(csv)).toThrow();
  });

  test('assigns correct channels to events', () => {
    const journeys = parseCSVText(VALID_CSV);
    const j1 = journeys.find(j => j.journeyId === 'j1')!;
    expect(j1.events[0].channel).toBe('Paid Search');
    expect(j1.events[1].channel).toBe('LinkedIn');
    expect(j1.events[2].channel).toBe('Email');
  });

  test('multiple journeys from same data are all present', () => {
    const journeys = parseCSVText(VALID_CSV);
    const ids = new Set(journeys.map(j => j.journeyId));
    expect(ids.has('j1')).toBe(true);
    expect(ids.has('j2')).toBe(true);
  });
});
