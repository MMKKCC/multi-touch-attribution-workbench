import { serialize, deserialize } from '../src/utils/urlSerializer.js';

describe('urlSerializer', () => {
  test('serialize returns a non-empty string', () => {
    const result = serialize({ foo: 'bar' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('round-trips a simple object', () => {
    const original = { channels: ['A', 'B'], seed: 42 };
    const encoded = serialize(original);
    const decoded = deserialize<typeof original>(encoded);
    expect(decoded).toEqual(original);
  });

  test('round-trips a nested object', () => {
    const original = {
      channels: ['Paid Search', 'Organic', 'Webinar'],
      transitions: [[0.1, 0.2, 0.3, 0.4], [0.2, 0.1, 0.4, 0.3]],
      journeyCount: 500,
      seed: 12345,
      config: { markovOrder: 2, shapleyIterations: 1000 },
    };
    const encoded = serialize(original);
    const decoded = deserialize<typeof original>(encoded);
    expect(decoded).toEqual(original);
  });

  test('encoded string uses only URL-safe characters', () => {
    const encoded = serialize({ test: 'value with spaces & special chars ≥ 1' });
    // Should not contain +, /, or = (standard Base64 characters replaced for URL safety)
    expect(encoded).not.toMatch(/[+/=]/);
    // Should only contain alphanumerics, hyphens, underscores
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('compressed output is shorter than raw JSON for typical config', () => {
    const config = {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      transitions: Array(6).fill(Array(8).fill(0.125)),
      entryProbs: [0.2, 0.2, 0.15, 0.2, 0.1, 0.15],
      journeyCount: 500,
      seed: 42,
      markovOrder: 1,
      shapleyIterations: 500,
    };
    const rawJson = JSON.stringify(config);
    const compressed = serialize(config);
    // Compressed + base64 should be well under raw JSON for a typical config
    expect(compressed.length).toBeLessThan(rawJson.length);
  });

  test('deserialize returns null for invalid input', () => {
    const result = deserialize('not-valid-base64-gzip!!!');
    expect(result).toBeNull();
  });

  test('deserialize returns null for empty string', () => {
    const result = deserialize('');
    expect(result).toBeNull();
  });

  test('different objects produce different encodings', () => {
    const a = serialize({ seed: 1 });
    const b = serialize({ seed: 2 });
    expect(a).not.toBe(b);
  });

  test('serializes large transition matrix within reasonable URL length', () => {
    const config = {
      channels: ['Paid Search', 'Organic', 'Webinar', 'LinkedIn', 'Referral', 'Email'],
      transitions: [
        [0.0, 0.1, 0.05, 0.5, 0.15, 0.05, 0.65, 0.1],
        [0.1, 0.0, 0.05, 0.4, 0.2, 0.05, 0.55, 0.15],
        [0.05, 0.1, 0.0, 0.35, 0.2, 0.05, 0.65, 0.1],
        [0.1, 0.15, 0.0, 0.0, 0.25, 0.0, 0.6, 0.1],
        [0.05, 0.1, 0.05, 0.1, 0.0, 0.05, 0.55, 0.1],
        [0.1, 0.05, 0.05, 0.2, 0.15, 0.0, 0.6, 0.15],
      ],
      entryProbs: [0.25, 0.2, 0.1, 0.2, 0.1, 0.15],
      journeyCount: 500,
      seed: 42,
      markovOrder: 1,
    };
    const encoded = serialize(config);
    // Full URL would be ?state=<encoded> — should fit within 2048 chars
    const fullUrlLength = '?state='.length + encoded.length;
    expect(fullUrlLength).toBeLessThan(2048);
  });
});
